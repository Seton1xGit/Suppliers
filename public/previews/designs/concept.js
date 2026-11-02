import { searchCatalog, deliveryMatch, categories } from "/catalog-source.js";

const variant = document.body.dataset.variant;
document.body.classList.add(`v${variant}`);
const e = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const sourceLink = (label, url, cls = "source") => {
  const a = e("a", cls, label);
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
};
const logo = '<a class="logo" href="./">поставка<span>.</span></a>';
const search =
  '<form class="search"><label><span class="sr-only">Товар или компания</span><input data-query type="search" placeholder="Товар или компания"></label><button class="search-submit">Найти</button></form>';
const region =
  '<label class="region-control"><span>Доставка в</span><select data-region aria-label="Город или регион доставки"></select></label>';
const category =
  '<div class="category-control" role="group" aria-label="Направление"><button data-category="" class="active">Все</button><button data-category="ingredients">Ингредиенты</button><button data-category="finished">Продукция</button><button data-category="packaging">Упаковка</button></div>';
const count = "<span data-count></span>";
const comparisonButton =
  '<button class="open-compare" data-open-compare>Сравнить <span data-compare-count>0</span></button>';
const results = "<div data-results></div>";
const summary = '<p class="result-summary" data-summary role="status"></p>';
const filterHelp =
  '<p class="filter-note">Фильтр учитывает опубликованную доставку. Город компании указан отдельно.</p>';
const provenance =
  '<p class="provenance">45 компаний в каталоге. Проверено 02.11.2026 по официальным сайтам. Условия заказа нужно уточнить.</p>';
const layouts = {
  "01": `<header class="header">${logo}<span class="brand-line">Снабжение food-бизнеса</span><nav>Каталог поставщиков</nav>${comparisonButton}</header><main><div class="page-title"><small>Поставка / Каталог</small><h1>Поставщики для вашего бизнеса</h1></div><div class="registry-layout"><aside><h2>Параметры поиска</h2>${search}${region}<h3>Направление</h3>${category}${filterHelp}</aside><section><div class="section-title"><h2>Результаты поиска</h2>${count}</div>${summary}<div class="registry-columns"><span>Компания и ассортимент</span><span>Подтвержденная доставка</span><span>Действия</span></div>${results}</section></div>${provenance}</main>`,
  "02": `<header class="header">${logo}<span class="brand-line">Поставщики. Товары. Контакты.</span>${search}${comparisonButton}</header><main><div class="market-heading"><div><small>КАТАЛОГ ДЛЯ ЗАКУПОК</small><h1>Что нужно вашему бизнесу?</h1></div>${region}</div>${category}${filterHelp}<div class="section-title"><h2>Предложения поставщиков</h2>${count}</div>${summary}${results}${provenance}</main>`,
  "03": `<header class="header">${logo}<b>РЕЕСТР ПОСТАВЩИКОВ</b><span class="database-label">КАТАЛОГ: 45 КОМПАНИЙ</span>${comparisonButton}</header><main><div class="table-heading"><h1>Подбор поставщиков</h1>${count}</div><div class="table-controls">${search}${region}${category}</div>${summary}${results}${filterHelp}${provenance}</main>`,
  "04": `<header class="header"><span class="edition">FOOD / ЗАКУПКИ</span>${logo}${comparisonButton}</header><main><div class="editorial-heading"><h1>Найти своих<br><em>поставщиков.</em></h1><div class="editorial-search"><p>Ингредиенты, готовая продукция и упаковка. Прямые контакты компаний для первого разговора.</p>${search}${region}</div></div><div class="editorial-rule">${category}${count}</div>${summary}${results}${provenance}</main>`,
  "05": `<div class="app-shell"><aside class="app-rail"><a class="rail-brand" href="./">п.</a><span class="rail-active">К</span><button data-open-compare aria-label="Открыть сравнение">С</button><span class="rail-bottom">45</span></aside><div class="app-body"><header class="header"><div><small>Рабочее пространство</small><h1>Поставщики</h1></div>${region}${comparisonButton}</header><div class="app-workspace"><aside class="app-filters"><h2>Направления</h2>${category}<div class="app-memo"><b>Ваш список для закупки</b><p>Выберите до 4 компаний и сравните условия в одном окне.</p></div>${filterHelp}</aside><main>${search}<div class="section-title"><h2>Каталог компаний</h2>${count}</div>${summary}${results}${provenance}</main></div></div></div>`,
  "06": `<header class="header">${logo}<span class="brand-line">РАБОЧИЙ КАТАЛОГ</span><span class="dark-status">Официальные источники</span>${comparisonButton}</header><main><div class="dark-heading"><div><small>ЗАКУПКИ / ПОСТАВЩИКИ</small><h1>Поставки под вашу задачу</h1></div>${count}</div><div class="dark-controls">${search}${region}</div>${category}<div class="dark-layout"><section>${summary}${results}</section><aside class="selection-panel"><span class="panel-label">СРАВНЕНИЕ</span><h2>Кого добавить<br>в список?</h2><p>Выберите компании в каталоге. Здесь появится ваш список для связи.</p><div data-selection></div>${comparisonButton}${filterHelp}</aside></div>${provenance}</main>`,
  "07": `<header class="header">${logo}<span class="brand-line">Все для кухни и производства</span>${comparisonButton}</header><main><div class="natural-heading"><div><small>КАТАЛОГ ДЛЯ FOOD-БИЗНЕСА</small><h1>Хорошие продукты<br>начинаются с поставки</h1></div><span class="natural-caption">Ингредиенты<br>Продукция<br>Упаковка</span></div><div class="natural-layout"><aside><h2>Что ищем?</h2>${search}${region}${category}${filterHelp}</aside><section><div class="section-title"><h2>Поставщики</h2>${count}</div>${summary}${results}</section></div>${provenance}</main>`,
  "08": `<header class="header">${logo}<span>КАТАЛОГ / РОССИЯ</span>${comparisonButton}</header><main><div class="type-heading"><h1>ПОСТАВЩИКИ<br>ДЛЯ FOOD-БИЗНЕСА</h1><div class="type-number">${count}<span>ВЫБРАННАЯ ГЕОГРАФИЯ</span></div></div><div class="type-filters">${search}${region}</div>${category}${summary}${results}${provenance}</main>`,
  "09": `<header class="header"><div class="technical-brand">ПОСТАВКА<span> / СНАБЖЕНИЕ</span></div><span class="technical-header-note">ИНГРЕДИЕНТЫ · ПРОДУКЦИЯ · УПАКОВКА</span>${comparisonButton}</header><div class="technical-strip"><span>КАТАЛОГ ПОСТАВЩИКОВ</span><span>ПРОВЕРКА: 02.11.2026</span></div><main><div class="technical-layout"><aside><small>ПАРАМЕТРЫ ПОДБОРА</small>${search}${region}${category}${filterHelp}</aside><section><div class="section-title"><h1>Реестр предложений</h1>${count}</div>${summary}${results}</section></div>${provenance}</main>`,
  10: `<header class="header">${logo}<span class="brand-line">Каталог food-поставщиков</span>${comparisonButton}</header><main><div class="search-first"><h1>Кого ищем для закупки?</h1>${search}<div class="search-first-filters">${region}${category}</div></div><div class="section-title"><h2>Подходящие компании</h2>${count}</div>${summary}${results}${filterHelp}${provenance}</main>`,
};
document.getElementById("concept-root").innerHTML = layouts[variant];
const data = await fetch("/data/catalog.json").then((r) => r.json());
let state = { query: "", category: "", region: "Новосибирск" },
  selected = [];
const regionControl = document.querySelector("[data-region]");
for (const name of [
  "",
  "Новосибирск",
  "Екатеринбург",
  "Москва",
  "Санкт-Петербург",
  "Россия",
]) {
  const option = e(
    "option",
    "",
    name === "Россия" ? "По всей России" : name || "Любой регион",
  );
  option.value = name;
  regionControl.append(option);
}
regionControl.value = state.region;
function action(s, label, cls, handler) {
  const button = e("button", cls, label);
  button.type = "button";
  button.addEventListener("click", handler);
  button.dataset.id = s.id;
  return button;
}
function delivery(s) {
  const match = deliveryMatch(s, state.region);
  return {
    match,
    label:
      match.scope === "national"
        ? "По всей России"
        : state.region
          ? `Доставка: ${state.region}`
          : s.delivery.length
            ? s.delivery.map((d) => d.region).join(", ")
            : "География не найдена",
  };
}
function contact(s) {
  const c = s.contacts.find((c) => c.url.startsWith("tel:")) || s.contacts[0];
  return sourceLink(
    c.url.startsWith("tel:") ? c.url.slice(4) : c.label,
    c.url,
    "contact",
  );
}
function compareButton(s) {
  const yes = selected.includes(s.id);
  const b = action(
    s,
    yes ? "В сравнении" : "+ Сравнить",
    "compare-action",
    () => toggle(s.id),
  );
  b.setAttribute("aria-pressed", String(yes));
  b.setAttribute(
    "aria-label",
    `${yes ? "Убрать из сравнения" : "Сравнить"}: ${s.name}`,
  );
  return b;
}
function nameBlock(s) {
  const block = e("div", "company-name");
  block.append(
    e("h2", "", s.name),
    e("span", "category-label", categories[s.category]),
    e("p", "city", `Компания: ${s.city}`),
  );
  return block;
}
function shippingBlock(s) {
  const d = delivery(s),
    block = e("div", "shipping");
  block.append(e("b", "shipping-label", d.label));
  const first = d.match.entries[0];
  if (first) {
    block.append(
      e("p", "shipping-proof", first.evidence),
      sourceLink("Источник доставки", first.sourceUrl),
    );
  } else
    block.append(
      e("p", "shipping-proof", "Уточни возможность доставки у компании."),
    );
  return block;
}
function actionsBlock(s) {
  const block = e("div", "actions");
  block.append(
    contact(s),
    sourceLink("Сайт компании", s.website),
    compareButton(s),
  );
  return block;
}
function card(s, index) {
  const item = e("article", `supplier ${deliveryMatch(s, state.region).scope}`);
  item.dataset.supplierId = s.id;
  if (variant === "02") {
    const keywords = e("div", "product-cover");
    keywords.append(
      e("span", "cover-category", categories[s.category]),
      e("strong", "", s.products[0]),
      e("span", "", s.products.slice(1, 3).join(" / ")),
    );
    item.append(keywords);
  }
  if (variant === "04" || variant === "08" || variant === "09")
    item.append(
      e(
        "span",
        "item-index",
        variant === "09" ? s.id : String(index + 1).padStart(2, "0"),
      ),
    );
  const main = e("div", "supplier-main");
  main.append(nameBlock(s), e("p", "products", s.products.join(", ")));
  if (s.minimumOrder && ["01", "05", "07", "09"].includes(variant))
    main.append(e("p", "minimum", s.minimumOrder.value));
  item.append(main, shippingBlock(s), actionsBlock(s));
  return item;
}
function table(items) {
  const wrap = e("div", "table-scroll"),
    table = e("table", "procurement-table");
  const head = e("thead"),
    row = e("tr");
  for (const label of [
    "Компания",
    "Ассортимент",
    "Город компании",
    "Доставка",
    "Источник",
    "Связаться / сравнить",
  ]) {
    const th = e("th", "", label);
    th.scope = "col";
    row.append(th);
  }
  head.append(row);
  table.append(head);
  const body = e("tbody");
  for (const s of items) {
    const row = e("tr", "supplier");
    row.dataset.supplierId = s.id;
    const values = [
      nameBlock(s),
      e("span", "", s.products.join(", ")),
      e("span", "", s.city),
      e("span", "", delivery(s).label),
      sourceLink(
        "Условия доставки",
        deliveryMatch(s, state.region).entries[0]?.sourceUrl ||
          s.sources[0].url,
      ),
      actionsBlock(s),
    ];
    for (const value of values) {
      const td = e("td");
      td.append(value);
      row.append(td);
    }
    body.append(row);
  }
  table.append(body);
  wrap.append(table);
  return wrap;
}
function render() {
  const items = searchCatalog(data, state),
    regional = items.filter(
      (s) => deliveryMatch(s, state.region).scope === "regional",
    ).length;
  document
    .querySelectorAll("[data-count]")
    .forEach(
      (n) =>
        (n.textContent = `${items.length} ${items.length % 100 >= 11 && items.length % 100 <= 14 ? "поставщиков" : items.length % 10 === 1 ? "поставщик" : items.length % 10 >= 2 && items.length % 10 <= 4 ? "поставщика" : "поставщиков"}`),
    );
  document.querySelector("[data-summary]").textContent = state.region
    ? `${state.region === "Россия" ? "По всей России" : state.region}: ${regional} с городской или региональной доставкой, ${items.length - regional} по России. Условия подтверждены ссылками на источники.`
    : `Все регионы. Город компании и география доставки указаны отдельно.`;
  document.querySelectorAll("[data-category]").forEach((b) => {
    b.classList.toggle("active", state.category === b.dataset.category);
    b.setAttribute(
      "aria-pressed",
      String(state.category === b.dataset.category),
    );
  });
  const result = document.querySelector("[data-results]");
  result.replaceChildren();
  if (!items.length)
    result.append(
      e(
        "div",
        "empty",
        "По этим условиям поставщики не найдены. Попробуй другой товар или регион.",
      ),
    );
  else if (variant === "03") result.append(table(items));
  else
    items.forEach((s, i) => {
      if (i === regional && regional && state.region) {
        const divider = e(
          "div",
          "nationwide-divider",
          "Далее: поставщики с доставкой по всей России",
        );
        result.append(divider);
      }
      result.append(card(s, i));
    });
  document
    .querySelectorAll("[data-compare-count]")
    .forEach((n) => (n.textContent = selected.length));
  const selection = document.querySelector("[data-selection]");
  if (selection) {
    selection.replaceChildren();
    for (const id of selected)
      selection.append(
        e("div", "selection-item", data.find((s) => s.id === id).name),
      );
  }
}
function tell(text) {
  const node = document.getElementById("feedback");
  node.textContent = text;
  node.hidden = false;
  clearTimeout(window.feedbackTimer);
  window.feedbackTimer = setTimeout(() => (node.hidden = true), 3500);
}
function toggle(id) {
  if (selected.includes(id)) selected = selected.filter((v) => v !== id);
  else if (selected.length < 4) selected.push(id);
  else {
    tell("Для сравнения можно выбрать до 4 компаний.");
    return;
  }
  render();
  if (document.getElementById("comparison").open) {
    document.getElementById("comparison").close();
    if (selected.length >= 2) openComparison();
  } else
    document
      .querySelector(`[data-results] .compare-action[data-id="${id}"]`)
      ?.focus({ preventScroll: true });
}
function openComparison() {
  if (selected.length < 2) {
    tell("Добавь от 2 до 4 поставщиков для сравнения.");
    return;
  }
  const body = document.getElementById("comparison-body");
  body.replaceChildren();
  for (const id of selected) {
    const s = data.find((s) => s.id === id),
      article = e("article", "comparison-company");
    article.append(
      nameBlock(s),
      e("p", "products", s.products.join(", ")),
      shippingBlock(s),
      actionsBlock(s),
    );
    body.append(article);
  }
  document.getElementById("comparison").showModal();
}
document.querySelector(".search").addEventListener("submit", (event) => {
  event.preventDefault();
  state.query = document.querySelector("[data-query]").value;
  render();
});
document.querySelector("[data-query]").addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});
regionControl.addEventListener("change", (event) => {
  state.region = event.target.value;
  render();
});
document.querySelectorAll("[data-category]").forEach((b) =>
  b.addEventListener("click", () => {
    state.category = b.dataset.category;
    render();
  }),
);
document
  .querySelectorAll("[data-open-compare]")
  .forEach((b) => b.addEventListener("click", openComparison));
document
  .getElementById("close-comparison")
  .addEventListener("click", () =>
    document.getElementById("comparison").close(),
  );
render();
document.body.dataset.ready = "true";
