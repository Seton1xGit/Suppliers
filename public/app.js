import {
  JsonCatalogSource,
  categories,
  deliveryMatch,
} from "./catalog-source.js";
import { createSavedStore } from "./storage.js";
import { designs, normalizeDesign, initialDesign } from "./designs.js";
import { mountLayout, supplierView, appendSupplierViews } from "./layouts.js";
const $ = (id) => document.getElementById(id),
  source = new JsonCatalogSource(),
  store = createSavedStore();
let items = [],
  filters = readFilters(),
  design = initialDesign(location.search, store.state.design),
  activeDetail = null,
  toastTimer;
const el = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
};
function button(text, className, action) {
  const b = el("button", className, text);
  b.type = "button";
  b.addEventListener("click", action);
  return b;
}
function link(text, url, className = "source-link") {
  const a = el("a", className, text);
  const parsed = new URL(url);
  if (!["https:", "http:", "mailto:", "tel:"].includes(parsed.protocol))
    return el("span", "", text);
  a.href = url;
  if (parsed.protocol.startsWith("http")) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }
  return a;
}
function toast(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => ($("toast").hidden = true), 4000);
}
function persist() {
  store.save(store.state);
  $("storage-warning").hidden = store.available;
}
function deliveryText(s) {
  return s.delivery.length
    ? s.delivery.map((d) => d.region).join(", ")
    : "География доставки не найдена";
}
function fact(label, value) {
  const n = el("div", "fact");
  n.append(el("div", "fact-label", label), el("div", "fact-value", value));
  return n;
}
function optional(s, key) {
  return s[key]?.value || "Не найдено";
}
function toggleSaved(id) {
  const set = new Set(store.state.saved);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  store.state.saved = [...set];
  persist();
  render();
  if (activeDetail === id) detail(id, false);
}
function toggleCompare(id) {
  const a = store.state.compare;
  if (a.includes(id)) store.state.compare = a.filter((v) => v !== id);
  else if (a.length === 4) {
    toast("Можно сравнить до 4 компаний. Удали одну из выбранных.");
    return;
  } else a.push(id);
  persist();
  render();
  if ($("compare-dialog").open) renderComparison();
}
function readFilters() {
  const params = new URLSearchParams(location.search);
  return {
    query: params.get("q") || "",
    category: categories[params.get("category")] ? params.get("category") : "",
    region: params.get("region") || "",
    savedOnly: params.get("view") === "saved",
  };
}
function saveFilters() {
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("design", design);
  if (filters.query) url.searchParams.set("q", filters.query);
  if (filters.category) url.searchParams.set("category", filters.category);
  if (filters.region) url.searchParams.set("region", filters.region);
  if (filters.savedOnly) url.searchParams.set("view", "saved");
  history.replaceState(null, "", url);
}
function supplierWord(n) {
  const last = n % 10,
    hundred = n % 100;
  return hundred >= 11 && hundred <= 14
    ? "поставщиков"
    : last === 1
      ? "поставщик"
      : last >= 2 && last <= 4
        ? "поставщика"
        : "поставщиков";
}
function supplierRow(s, index) {
  const match = deliveryMatch(s, filters.region),
    labels = match.entries.map((d) => d.region);
  let deliveryLabel =
    labels.length > 2
      ? `${labels.slice(0, 2).join(", ")} и еще ${labels.length - 2}`
      : labels.join(", ");
  if (filters.region && match.scope === "regional")
    deliveryLabel = `Доставка: ${filters.region}`;
  if (
    match.scope === "national" ||
    (!filters.region && labels.includes("Россия"))
  )
    deliveryLabel = "По всей России";
  const evidence = !filters.region
    ? match.entries.find((d) => d.region === "Россия") || match.entries[0]
    : match.entries[0];
  const actions = el("div", "actions card-actions");
  const compare = button(
    store.state.compare.includes(s.id) ? "В сравнении" : "+ Сравнить",
    "compare-button",
    () => toggleCompare(s.id),
  );
  compare.setAttribute(
    "aria-pressed",
    String(store.state.compare.includes(s.id)),
  );
  compare.setAttribute(
    "aria-label",
    `${store.state.compare.includes(s.id) ? "Убрать из сравнения" : "Сравнить"}: ${s.name}`,
  );
  const save = button(
    store.state.saved.includes(s.id) ? "Сохранено" : "Сохранить",
    "save-button",
    () => toggleSaved(s.id),
  );
  save.setAttribute("aria-pressed", String(store.state.saved.includes(s.id)));
  save.setAttribute(
    "aria-label",
    `${store.state.saved.includes(s.id) ? "Убрать из сохраненного" : "Сохранить"}: ${s.name}`,
  );
  const contact =
    s.contacts.find((c) => c.url.startsWith("tel:")) || s.contacts[0];
  actions.append(
    link(
      contact.url.startsWith("tel:")
        ? contact.url.slice(4)
        : "Написать поставщику",
      contact.url,
      "contact",
    ),
    button("Карточка и заметка", "details-button", () => detail(s.id)),
    compare,
    save,
  );
  if (design !== "03")
    actions.append(link("Сайт компании", s.website, "source"));
  return supplierView(
    s,
    index,
    {
      design,
      match,
      deliveryLabel: deliveryLabel || "География не найдена",
      evidence,
      note: store.state.notes[s.id],
    },
    { el, link, actions },
  );
}
function appendSuppliers(container, list, start = 0) {
  appendSupplierViews(container, list, start, design, supplierRow, el);
}
function resultGroup(title, list, scope, description) {
  const group = el("section", `result-group ${scope}`),
    heading = el("div", "group-heading");
  heading.append(
    el("h2", "", title),
    el("span", "", String(list.length).padStart(2, "0")),
  );
  group.append(heading);
  if (description) group.append(el("p", "group-description", description));
  return group;
}
function render() {
  const focused = document.activeElement;
  const focusedRow = focused?.closest(".card");
  const focusTarget =
    focusedRow &&
    ["compare-button", "save-button"].find((c) =>
      focused.classList.contains(c),
    );
  const focusedId = focusedRow?.dataset.supplierId;
  saveFilters();
  const found = source.search(items, { ...filters, saved: store.state.saved });
  const regional = found.filter(
    (s) => deliveryMatch(s, filters.region).scope === "regional",
  );
  const national = found.filter(
    (s) => deliveryMatch(s, filters.region).scope === "national",
  );
  $("result-count").textContent =
    `${found.length} ${supplierWord(found.length)}`;
  const category = categories[filters.category] || "Все направления";
  $("view-caption").textContent =
    `${filters.savedOnly ? "Сохраненные / " : ""}${category} / ${filters.region ? `Доставка: ${filters.region === "Россия" ? "вся Россия" : filters.region}` : "Без ограничения доставки"}`;
  $("region-summary").textContent = !filters.region
    ? `Весь каталог. У ${items.filter((s) => !s.delivery.length).length} компаний география не найдена: выбери город, чтобы оставить только подтвержденную доставку.`
    : filters.region === "Россия"
      ? `Показаны ${national.length} ${supplierWord(national.length)} с опубликованной доставкой по всей России. Маршрут и условия перевозки уточняй отдельно.`
      : `${filters.region}: ${regional.length} с подтвержденной городской или региональной доставкой, ${national.length} с доставкой по России. Город компании указан отдельно.`;
  $("saved-count").textContent = store.state.saved.length;
  for (const [id, active] of [
    ["saved-nav", filters.savedOnly],
    ["catalog-nav", !filters.savedOnly],
  ]) {
    $(id).setAttribute("aria-pressed", String(active));
    $(id).classList.toggle("active", active);
  }
  document.querySelectorAll("[data-category]").forEach((b) => {
    const active = b.dataset.category === filters.category;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
    b.querySelector("[data-count]").textContent = source.search(items, {
      ...filters,
      category: b.dataset.category,
      saved: store.state.saved,
    }).length;
  });
  $("cards").replaceChildren();
  if (!found.length) {
    const empty = el("div", "empty");
    empty.append(
      el(
        "h3",
        "",
        filters.savedOnly
          ? "Сохраненных компаний по этим условиям нет"
          : "По этим условиям поставщики не найдены",
      ),
      el(
        "p",
        "",
        `В каталоге ${items.length} компаний. Попробуй другой товар или регион. Отсутствие результатов не означает, что доставка невозможна: в источниках может не быть подтверждения.`,
      ),
      button("Сбросить условия поиска", "button quiet", reset),
    );
    $("cards").append(empty);
  } else if (!filters.region) appendSuppliers($("cards"), found);
  else {
    if (filters.region !== "Россия") {
      const group = resultGroup(
        `Доставка: ${filters.region}`,
        regional,
        "regional",
      );
      if (!regional.length) {
        const empty = el("div", "empty regional-empty");
        empty.append(
          el("h3", "", "Городская или региональная доставка не подтверждена"),
          el(
            "p",
            "",
            "Ниже только компании, которые прямо заявляют доставку по России. Местонахождение офиса не используется вместо доказательства доставки.",
          ),
        );
        group.append(empty);
      }
      appendSuppliers(group, regional);
      $("cards").append(group);
    }
    if (national.length) {
      const group = resultGroup(
        filters.region === "Россия"
          ? "Доставляют по всей России"
          : "Также доставляют по России",
        national,
        "national",
        "Общероссийское покрытие по официальному источнику. Оно не гарантирует доставку любого товара по любому адресу: уточни маршрут, температурный режим и стоимость.",
      );
      appendSuppliers(group, national, regional.length);
      $("cards").append(group);
    }
  }
  $("compare-bar").hidden = !store.state.compare.length;
  $("compare-count").textContent =
    `Выбрано: ${store.state.compare.length} из 4`;
  $("compare-names").textContent = store.state.compare
    .map((id) => items.find((s) => s.id === id)?.name)
    .join(" / ");
  $("compare-open").disabled = store.state.compare.length < 2;
  document
    .querySelectorAll("[data-compare-count]")
    .forEach((n) => (n.textContent = store.state.compare.length));
  const selection = document.querySelector("[data-selection]");
  if (selection) {
    selection.replaceChildren();
    store.state.compare.forEach((id) =>
      selection.append(
        el("div", "selection-item", items.find((s) => s.id === id)?.name),
      ),
    );
  }
  document.body.dataset.ready = "true";
  if (focusTarget)
    document
      .querySelector(`[data-supplier-id="${focusedId}"] .${focusTarget}`)
      ?.focus({ preventScroll: true });
}
function section(title) {
  const n = el("section", "detail-section");
  n.append(el("h3", "", title));
  return n;
}
function notesField(s) {
  const wrapper = el("div", "detail-section"),
    label = el("label", "notes-label", "Моя заметка"),
    textarea = el("textarea");
  textarea.id = `note-${s.id}`;
  label.htmlFor = textarea.id;
  textarea.maxLength = 3000;
  textarea.placeholder = "Объем, вопросы менеджеру, результат звонка";
  textarea.value = store.state.notes[s.id] || "";
  textarea.addEventListener("input", () => {
    if (textarea.value) store.state.notes[s.id] = textarea.value;
    else delete store.state.notes[s.id];
    persist();
  });
  wrapper.append(
    label,
    textarea,
    el("p", "muted", "Заметка остается только в этом браузере."),
  );
  return wrapper;
}
function detail(id, show = true) {
  const s = items.find((i) => i.id === id);
  activeDetail = id;
  const body = $("detail-content");
  body.replaceChildren();
  const title = el("h2", "detail-title", s.name);
  title.id = "detail-title";
  body.append(
    title,
    el("p", "muted", `${categories[s.category]} / Город компании: ${s.city}`),
  );
  const contacts = el("div", "contact-links");
  contacts.append(link("Сайт поставщика", s.website, "button primary"));
  s.contacts.forEach((c) =>
    contacts.append(link(c.label, c.url, "button quiet")),
  );
  body.append(contacts);
  const products = section("Что поставляет");
  products.append(el("p", "", s.products.join(", ")));
  body.append(products);
  const delivery = section("Подтвержденная доставка");
  if (!s.delivery.length)
    delivery.append(
      el(
        "p",
        "",
        "География не найдена. Уточни возможность доставки в свой город.",
      ),
    );
  s.delivery.forEach((d) => {
    const p = el("p");
    p.append(
      el("b", "", d.region),
      el("span", "", `. ${d.evidence} `),
      link("Источник", d.sourceUrl),
    );
    delivery.append(p);
  });
  body.append(delivery);
  const terms = section("Условия для запроса"),
    facts = el("div", "facts");
  [
    ["Минимальный заказ", "minimumOrder"],
    ["Цена конкретного товара", "price"],
    ["Документы и сертификаты", "documents"],
  ].forEach(([label, key]) => {
    const f = fact(label, optional(s, key));
    if (s[key]?.sourceUrl) f.append(link("Источник", s[key].sourceUrl));
    facts.append(f);
  });
  terms.append(
    facts,
    el(
      "p",
      "muted",
      "Не найдено означает, что данных нет в проверенных источниках. Запроси условия у менеджера.",
    ),
  );
  body.append(terms);
  body.append(notesField(s));
  const sources = section(
    `Источники / проверено ${s.verifiedAt.split("-").reverse().join(".")}`,
  );
  s.sources.forEach((v) => {
    const p = el("p");
    p.append(link(v.label, v.url));
    sources.append(p);
  });
  body.append(sources);
  body.append(
    button(
      store.state.saved.includes(id)
        ? "Убрать из сохраненного"
        : "Сохранить компанию",
      "button quiet",
      () => toggleSaved(id),
    ),
  );
  if (show) $("detail-dialog").showModal();
}
function renderComparison() {
  const restoreFocus = !!document.activeElement?.closest(".company-cell");
  $("compare-content").replaceChildren();
  const selected = store.state.compare.map((id) =>
    items.find((s) => s.id === id),
  );
  if (!selected.length) {
    $("compare-dialog").close();
    return;
  }
  const grid = el("div", `compare-grid columns-${selected.length}`);
  grid.setAttribute("role", "table");
  grid.setAttribute("aria-label", "Условия выбранных поставщиков");
  const addRow = (label, build) => {
    const row = el("div", "compare-row");
    row.setAttribute("role", "row");
    const field = el("div", "compare-cell field-name", label);
    field.setAttribute("role", "rowheader");
    row.append(field);
    for (const s of selected) {
      const cell = el("div", "compare-cell");
      cell.setAttribute("role", "cell");
      build(cell, s);
      row.append(cell);
    }
    grid.append(row);
  };
  addRow("Компания", (cell, s) => {
    cell.classList.add("company-cell");
    cell.setAttribute("role", "columnheader");
    cell.dataset.supplierId = s.id;
    cell.append(
      el("span", "tag", categories[s.category]),
      el("h3", "", s.name),
      button("Удалить", "text-button", () => toggleCompare(s.id)),
    );
  });
  addRow("Город компании", (cell, s) => cell.append(el("span", "", s.city)));
  addRow("Товары", (cell, s) =>
    cell.append(el("span", "", s.products.join(", "))),
  );
  addRow("Подтвержденная доставка", (cell, s) => {
    if (!s.delivery.length) cell.append(el("span", "", "Не найдено"));
    for (const d of s.delivery) {
      const p = el("p");
      p.append(
        el("b", "", d.region),
        el("span", "", `. ${d.evidence} `),
        link("Источник", d.sourceUrl),
      );
      cell.append(p);
    }
  });
  for (const [label, key] of [
    ["Минимальный заказ", "minimumOrder"],
    ["Цена конкретного товара", "price"],
    ["Документы", "documents"],
  ])
    addRow(label, (cell, s) => {
      cell.append(el("p", "", optional(s, key)));
      if (s[key]?.sourceUrl) cell.append(link("Источник", s[key].sourceUrl));
    });
  addRow("Контакты", (cell, s) => {
    for (const c of s.contacts) {
      const p = el("p");
      p.append(link(c.label, c.url));
      cell.append(p);
    }
    cell.append(link("Сайт компании", s.website));
  });
  addRow("Моя заметка", (cell, s) =>
    cell.append(el("span", "", store.state.notes[s.id] || "Нет заметки")),
  );
  addRow("Проверено", (cell, s) =>
    cell.append(el("span", "", s.verifiedAt.split("-").reverse().join("."))),
  );
  $("compare-content").append(grid);
  if (restoreFocus)
    grid.querySelector(".company-cell button")?.focus({ preventScroll: true });
}
function reset() {
  filters = { query: "", category: "", region: "", savedOnly: false };
  $("query").value = "";
  $("region").value = "";
  render();
}
function populateRegions() {
  const regions = [
    ...new Set(
      [
        ...items.flatMap((s) => s.delivery.map((d) => d.region)),
        "Москва",
        "Московская область",
        "Санкт-Петербург",
        "Ленинградская область",
        "Екатеринбург",
        "Свердловская область",
        "Новосибирск",
        "Новосибирская область",
        "Краснодарский край",
        "Республика Татарстан",
        "Россия",
        filters.region,
      ].filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "ru"));
  $("region").replaceChildren();
  const all = el("option", "", "Без ограничения");
  all.value = "";
  $("region").append(all);
  for (const r of regions) {
    const option = el(
      "option",
      "",
      r === "Россия" ? "Доставка по всей России" : r,
    );
    option.value = r;
    $("region").append(option);
  }
  $("query").value = filters.query;
  $("region").value = filters.region;
}
function bindLayout() {
  populateRegions();
  $("search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    filters.query = $("query").value;
    render();
  });
  $("query").addEventListener("input", () => {
    filters.query = $("query").value;
    render();
  });
  $("categories").addEventListener("click", (event) => {
    const b = event.target.closest("[data-category]");
    if (b) {
      filters.category = b.dataset.category;
      render();
    }
  });
  $("region").addEventListener("change", () => {
    filters.region = $("region").value;
    render();
  });
  document.querySelectorAll("[data-open-compare]").forEach((b) =>
    b.addEventListener("click", () => {
      if (store.state.compare.length < 2) {
        toast("Для сравнения добавь от 2 до 4 компаний.");
        return;
      }
      renderComparison();
      $("compare-dialog").showModal();
    }),
  );
}
function chooseDesign(value) {
  design = normalizeDesign(value);
  store.state.design = design;
  mountLayout($("workspace"), design);
  bindLayout();
  persist();
  render();
  updateDesignPicker();
  $("design-picker").open = false;
  $("design-picker").querySelector("summary").focus({ preventScroll: true });
}
function updateDesignPicker() {
  document
    .querySelectorAll("[data-design-choice]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.designChoice === design)),
    );
}
for (const [id, name] of designs) {
  const b = button(
    `${id}. ${name}${id === "03" ? " (основной)" : ""}`,
    "design-option",
    () => chooseDesign(id),
  );
  b.dataset.designChoice = id;
  $("design-options").append(b);
}
$("main-design").addEventListener("click", () => chooseDesign("03"));
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    $("design-picker").open &&
    !document.querySelector("dialog[open]")
  ) {
    $("design-picker").open = false;
    $("design-picker").querySelector("summary").focus();
  }
});
document.addEventListener("click", (event) => {
  if ($("design-picker").open && !$("design-picker").contains(event.target))
    $("design-picker").open = false;
});
$("reset").addEventListener("click", reset);
$("catalog-nav").addEventListener("click", () => {
  filters.savedOnly = false;
  render();
});
store.state.design = design;
mountLayout($("workspace"), design);
bindLayout();
updateDesignPicker();
$("saved-nav").addEventListener("click", () => {
  filters.savedOnly = !filters.savedOnly;
  render();
  $("results").scrollIntoView({ behavior: "smooth" });
});
$("compare-open").addEventListener("click", () => {
  renderComparison();
  $("compare-dialog").showModal();
});
$("compare-clear").addEventListener("click", () => {
  store.state.compare = [];
  persist();
  render();
});
$("clear-saved").addEventListener("click", () => {
  if (
    !confirm(
      "Удалить сохраненные компании, сравнение и заметки из этого браузера?",
    )
  )
    return;
  store.save({ saved: [], notes: {}, compare: [], design });
  activeDetail = null;
  persist();
  render();
  toast("Сохраненные данные очищены");
});
document
  .querySelectorAll(".close-dialog")
  .forEach((b) =>
    b.addEventListener("click", () => b.closest("dialog").close()),
  );
$("detail-dialog").addEventListener("close", () => (activeDetail = null));
try {
  items = await source.load();
  const valid = new Set(items.map((s) => s.id));
  store.state.saved = store.state.saved.filter((id) => valid.has(id));
  store.state.compare = store.state.compare.filter((id) => valid.has(id));
  store.state.notes = Object.fromEntries(
    Object.entries(store.state.notes).filter(([id]) => valid.has(id)),
  );
  persist();
  $("total-count").textContent = items.length;
  populateRegions();
  render();
} catch {
  $("result-count").textContent = "Не удалось загрузить каталог";
  const empty = el("div", "empty");
  empty.append(
    el("p", "", "Проверь подключение и повтори загрузку."),
    button("Повторить", "button primary", () => location.reload()),
  );
  $("cards").append(empty);
}
