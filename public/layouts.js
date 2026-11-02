import { categories } from "./catalog-source.js";
import { designs, designNumber, designLayout } from "./designs.js";
const logo = '<a class="logo" href="/">поставка<span>.</span></a>';
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
const provenance = "";
const layouts = {
  registry: `<header class="header">${logo}<span class="brand-line">Снабжение food-бизнеса</span><nav>Каталог поставщиков</nav>${comparisonButton}</header><main><div class="page-title"><small>Поставка / Каталог</small><h1>Поставщики для вашего бизнеса</h1></div><div class="registry-layout"><aside><h2>Параметры поиска</h2>${search}${region}<h3>Направление</h3>${category}${filterHelp}</aside><section><div class="section-title"><h2>Результаты поиска</h2>${count}</div>${summary}<div class="registry-columns"><span>Компания и ассортимент</span><span>Подтвержденная доставка</span><span>Действия</span></div>${results}</section></div>${provenance}</main>`,
  table: `<header class="header">${logo}<b>РЕЕСТР ПОСТАВЩИКОВ</b><span class="database-label" data-catalog-total>КАТАЛОГ</span>${comparisonButton}</header><main><div class="table-heading"><h1>Подбор поставщиков</h1>${count}</div><div class="table-controls">${search}${region}${category}</div>${summary}${results}${filterHelp}${provenance}</main>`,
  workspace: `<div class="app-shell"><aside class="app-rail"><a class="rail-brand" href="/">п.</a><span class="rail-active">К</span><button data-open-compare aria-label="Открыть сравнение">С</button><span class="rail-bottom" data-catalog-total></span></aside><div class="app-body"><header class="header"><div><small>Рабочее пространство</small><h1>Поставщики</h1></div>${region}${comparisonButton}</header><div class="app-workspace"><aside class="app-filters"><h2>Направления</h2>${category}<div class="app-memo"><b>Ваш список для закупки</b><p>Выберите до 4 компаний и сравните условия в одном окне.</p></div>${filterHelp}</aside><main>${search}<div class="section-title"><h2>Каталог компаний</h2>${count}</div>${summary}${results}${provenance}</main></div></div></div>`,
  dark: `<header class="header">${logo}<span class="brand-line">РАБОЧИЙ КАТАЛОГ</span><span class="dark-status">Официальные источники</span>${comparisonButton}</header><main><div class="dark-heading"><div><small>ЗАКУПКИ / ПОСТАВЩИКИ</small><h1>Поставки под вашу задачу</h1></div>${count}</div><div class="dark-controls">${search}${region}</div>${category}<div class="dark-layout"><section>${summary}${results}</section><aside class="selection-panel"><span class="panel-label">СРАВНЕНИЕ</span><h2>Кого добавить<br>в список?</h2><p>Выберите компании в каталоге. Здесь появится ваш список для связи.</p><div data-selection></div>${comparisonButton}${filterHelp}</aside></div>${provenance}</main>`,
  type: `<header class="header">${logo}<span>КАТАЛОГ / РОССИЯ</span>${comparisonButton}</header><main><div class="type-heading"><h1>ПОСТАВЩИКИ<br>ДЛЯ FOOD-БИЗНЕСА</h1><div class="type-number">${count}<span>ВЫБРАННАЯ ГЕОГРАФИЯ</span></div></div><div class="type-filters">${search}${region}</div>${category}${summary}${results}${provenance}</main>`,
  technical: `<header class="header"><div class="technical-brand">ПОСТАВКА<span> / СНАБЖЕНИЕ</span></div><span class="technical-header-note">ИНГРЕДИЕНТЫ · ПРОДУКЦИЯ · УПАКОВКА</span>${comparisonButton}</header><div class="technical-strip"><span>КАТАЛОГ ПОСТАВЩИКОВ</span><span>ПРОВЕРКА: 02.11.2026</span></div><main><div class="technical-layout"><aside><small>ПАРАМЕТРЫ ПОДБОРА</small>${search}${region}${category}${filterHelp}</aside><section><div class="section-title"><h1>Реестр предложений</h1>${count}</div>${summary}${results}</section></div>${provenance}</main>`,
  search: `<header class="header">${logo}<span class="brand-line">Каталог food-поставщиков</span>${comparisonButton}</header><main><div class="search-first"><h1>Кого ищем для закупки?</h1>${search}<div class="search-first-filters">${region}${category}</div></div><div class="section-title"><h2>Подходящие компании</h2>${count}</div>${summary}${results}${filterHelp}${provenance}</main>`,
};
export function mountLayout(root, design) {
  document.body.className = `v${designLayout(design)}`;
  document.body.dataset.design = design;
  root.innerHTML = layouts[design];
  root.querySelector(".search").id = "search-form";
  root.querySelector("[data-query]").id = "query";
  root.querySelector("[data-region]").id = "region";
  root
    .querySelector("[data-region]")
    .setAttribute("aria-describedby", "region-summary");
  const counter = root.querySelector("[data-count]");
  counter.id = "result-count";
  counter.setAttribute("aria-live", "polite");
  counter.textContent = "Загружаем каталог";
  const category = root.querySelector(".category-control");
  category.id = "categories";
  category.querySelectorAll("[data-category]").forEach((b) => {
    const text = b.textContent;
    b.replaceChildren();
    const label = document.createElement("span");
    label.textContent = text;
    const count = document.createElement("span");
    count.dataset.count = b.dataset.category;
    b.append(label, count);
  });
  root.querySelector("[data-results]").id = "cards";
  const summary = root.querySelector("[data-summary]");
  summary.id = "region-summary";
  const caption = document.createElement("p");
  caption.id = "view-caption";
  caption.className = "sr-only";
  summary.before(caption);
  root.querySelector("main").id = "results";
  root.querySelector("main").tabIndex = -1;
  root.querySelectorAll(".provenance").forEach((n) => n.remove());
  document.getElementById("design-current").textContent =
    `${designNumber(design)}. ${designs.find(([id]) => id === design)[1]}`;
}
export function supplierView(s, index, view, kit) {
  const { el, link, actions } = kit,
    table = view.design === "03";
  const card = el(table ? "tr" : "article", "card supplier");
  card.dataset.supplierId = s.id;
  card.dataset.scope = view.match.scope;
  const name = el("div", "company-name");
  const heading = el("h2"),
    open = el("button", "company-name-button", s.name);
  open.type = "button";
  open.setAttribute("aria-haspopup", "dialog");
  open.setAttribute("aria-controls", "detail-dialog");
  open.addEventListener("click", kit.openDetail);
  heading.append(open);
  name.append(heading, el("span", "category-label", categories[s.category]));
  const city = el("p", "city", `Компания: ${s.city}`),
    products = el("p", "products", s.products.join(", "));
  if (view.searchMatch?.related) {
    const match = view.searchMatch.related;
    products.append(
      el(
        "span",
        "search-reason",
        match.kind === "group"
          ? `Совпадение по группе: ${match.product}. Наличие конкретного товара уточни у компании.`
          : `Связанный товар: ${match.product}.`,
      ),
    );
    card.dataset.searchMatch = match.kind;
  }
  const shipping = el("div", "shipping");
  shipping.append(
    el(
      "p",
      `delivery shipping-label ${!s.delivery.length ? "unknown" : ""}`,
      view.deliveryLabel,
    ),
  );
  shipping.append(el("p", "delivery-cost", view.deliveryCost));
  const evidence = view.evidence;
  if (evidence) {
    shipping.append(
      el("p", "shipping-proof", evidence.evidence),
      link("Источник доставки", evidence.sourceUrl, "source"),
    );
  } else
    shipping.append(
      el(
        "p",
        "shipping-proof",
        "Возможность доставки нужно уточнить у компании.",
      ),
    );
  const sources = el("div", "sources");
  s.sources
    .slice(0, 2)
    .forEach((source) =>
      sources.append(link(source.label, source.url, "source")),
    );
  if (s.sources.length > 2)
    sources.append(
      el("span", "", `Еще ${s.sources.length - 2} источника в карточке`),
    );
  sources.append(
    el("span", "verified-date", s.verifiedAt.split("-").reverse().join(".")),
  );
  if (view.note) sources.append(el("span", "note-indicator", "Есть заметка"));
  if (table) {
    for (const content of [
      name,
      view.offerBlock,
      products,
      el("span", "", s.city),
      shipping,
      sources,
      actions,
    ]) {
      const td = el("td");
      td.append(content);
      card.append(td);
    }
    return card;
  }
  if (["08", "09"].includes(view.design))
    card.append(
      el(
        "span",
        "item-index",
        view.design === "09" ? s.id : String(index + 1).padStart(2, "0"),
      ),
    );
  name.append(city);
  const main = el("div", "supplier-main");
  main.append(name, view.offerBlock, products);
  if (s.minimumOrder && ["01", "05", "09"].includes(view.design))
    main.append(el("p", "minimum", s.minimumOrder.value));
  if (view.note) main.append(el("span", "note-indicator", "Есть заметка"));
  card.append(main, shipping, actions);
  return card;
}
export function appendSupplierViews(container, list, start, design, build, el) {
  if (!list.length) return;
  const wrapper = el("div", design === "03" ? "table-scroll" : "result-items");
  if (design === "03") {
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", "Поставщики и условия заказа");
    const table = el("table", "procurement-table");
    const caption = el("caption", "sr-only", "Поставщики и условия заказа");
    table.append(caption);
    const thead = el("thead"),
      row = el("tr");
    for (const label of [
      "Компания",
      "Цена товара",
      "Ассортимент",
      "Город компании",
      "Подтвержденная доставка",
      "Источники / проверка",
      "Контакты / действия",
    ]) {
      const th = el("th", "", label);
      th.scope = "col";
      row.append(th);
    }
    thead.append(row);
    table.append(thead);
    const tbody = el("tbody");
    list.forEach((s, i) => tbody.append(build(s, start + i)));
    table.append(tbody);
    wrapper.append(table);
  } else list.forEach((s, i) => wrapper.append(build(s, start + i)));
  container.append(wrapper);
}
