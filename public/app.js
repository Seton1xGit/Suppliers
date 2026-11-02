import { JsonCatalogSource, categories } from "./catalog-source.js";
import { createSavedStore } from "./storage.js";
const $ = (id) => document.getElementById(id),
  source = new JsonCatalogSource(),
  store = createSavedStore();
let items = [],
  filters = { query: "", category: "", region: "", savedOnly: false },
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
function render() {
  const found = source.search(items, { ...filters, saved: store.state.saved });
  $("result-count").textContent =
    `${found.length} ${found.length === 1 ? "поставщик" : found.length >= 2 && found.length <= 4 ? "поставщика" : "поставщиков"}`;
  $("view-caption").textContent = filters.savedOnly
    ? "Сохраненные компании"
    : "Подборка для закупки";
  $("saved-count").textContent = store.state.saved.length;
  $("saved-nav").setAttribute("aria-pressed", String(filters.savedOnly));
  $("cards").replaceChildren();
  if (!found.length) {
    const empty = el("div", "empty");
    empty.append(
      el(
        "h3",
        "",
        filters.savedOnly
          ? "Здесь пока нет подходящих сохраненных"
          : "Поставщики не найдены",
      ),
      el(
        "p",
        "",
        "Попробуй другой товар или сбрось фильтры. Каталог пока охватывает 30 компаний.",
      ),
      button("Показать весь каталог", "button quiet", reset),
    );
    $("cards").append(empty);
  }
  for (const s of found) {
    const card = el("article", "card"),
      top = el("div", "card-top"),
      save = button(
        store.state.saved.includes(s.id) ? "Сохранено" : "Сохранить",
        "save-button",
        () => toggleSaved(s.id),
      );
    save.setAttribute("aria-pressed", String(store.state.saved.includes(s.id)));
    save.setAttribute(
      "aria-label",
      `${store.state.saved.includes(s.id) ? "Убрать из сохраненного" : "Сохранить"}: ${s.name}`,
    );
    top.append(el("span", `tag ${s.category}`, categories[s.category]), save);
    const actions = el("div", "card-actions"),
      compare = button(
        store.state.compare.includes(s.id)
          ? "Убрать из сравнения"
          : "+ К сравнению",
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
    actions.append(
      button("Подробнее", "details-button", () => detail(s.id)),
      compare,
    );
    card.append(
      top,
      el("h3", "", s.name),
      el("p", "location", `Город компании: ${s.city}`),
      el("p", "products", s.products.join(" · ")),
      el(
        "p",
        `delivery ${s.delivery.length ? "confirmed" : ""}`,
        s.delivery.length ? `Доставка: ${deliveryText(s)}` : deliveryText(s),
      ),
      actions,
    );
    $("cards").append(card);
  }
  $("compare-bar").hidden = !store.state.compare.length;
  $("compare-count").textContent =
    `Выбрано: ${store.state.compare.length} из 4`;
  $("compare-open").disabled = store.state.compare.length < 2;
  document.querySelectorAll("[data-category]").forEach((b) => {
    const active = b.dataset.category === filters.category;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
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
  $("compare-content").replaceChildren();
  if (!store.state.compare.length) {
    $("compare-dialog").close();
    return;
  }
  for (const id of store.state.compare) {
    const s = items.find((v) => v.id === id),
      col = el("article");
    col.append(
      el("span", `tag ${s.category}`, categories[s.category]),
      el("h3", "", s.name),
      button("Удалить", "text-button", () => toggleCompare(id)),
      fact("Город компании", s.city),
      fact("Товары", s.products.join(", ")),
      fact("Доставка", deliveryText(s)),
      fact("Минимальный заказ", optional(s, "minimumOrder")),
      fact("Цена конкретного товара", optional(s, "price")),
      fact("Документы", optional(s, "documents")),
    );
    const contacts = section("Связаться");
    s.contacts.forEach((c) => {
      const p = el("p");
      p.append(link(c.label, c.url));
      contacts.append(p);
    });
    contacts.append(link("Сайт", s.website));
    col.append(
      contacts,
      fact("Моя заметка", store.state.notes[id] || "Нет заметки"),
    );
    s.sources.forEach((v) => {
      const p = el("p");
      p.append(link(v.label, v.url));
      col.append(p);
    });
    col.append(el("p", "muted", `Проверено: ${s.verifiedAt}`));
    $("compare-content").append(col);
  }
}
function reset() {
  filters = { query: "", category: "", region: "", savedOnly: false };
  $("query").value = "";
  $("region").value = "";
  render();
}
$("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  filters.query = $("query").value;
  render();
});
$("query").addEventListener("input", () => {
  filters.query = $("query").value;
  render();
});
$("categories").addEventListener("click", (e) => {
  const b = e.target.closest("[data-category]");
  if (b) {
    filters.category = b.dataset.category;
    render();
  }
});
$("region").addEventListener("change", () => {
  filters.region = $("region").value;
  render();
});
$("reset").addEventListener("click", reset);
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
  store.save({ saved: [], notes: {}, compare: [] });
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
  const regions = [
    ...new Set(items.flatMap((s) => s.delivery.map((d) => d.region))),
  ].sort((a, b) => a.localeCompare(b, "ru"));
  // Обычные регионы доступны и при федеральной доставке.
  if (regions.includes("Россия"))
    for (const r of [
      "Москва",
      "Московская область",
      "Санкт-Петербург",
      "Ленинградская область",
      "Екатеринбург",
      "Свердловская область",
      "Новосибирск",
      "Краснодарский край",
      "Республика Татарстан",
    ])
      if (!regions.includes(r)) regions.push(r);
  regions
    .sort((a, b) => a.localeCompare(b, "ru"))
    .forEach((r) => {
      const option = el("option", "", r === "Россия" ? "Вся Россия" : r);
      option.value = r;
      $("region").append(option);
    });
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
