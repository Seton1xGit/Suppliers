export const concepts = [
  [
    "01",
    "Деловой реестр",
    "Строгая сетка, фильтры слева и последовательный список компаний.",
  ],
  [
    "02",
    "B2B-маркет",
    "Карточки с акцентом на ассортимент и фильтры над результатами.",
  ],
  [
    "03",
    "Таблица закупщика",
    "Плотная таблица: условия нескольких поставщиков видны одновременно.",
  ],
  [
    "04",
    "Гастрономический журнал",
    "Редакционная верстка, асимметрия и выразительная антиква.",
  ],
  [
    "05",
    "Рабочее приложение",
    "Вертикальная навигация и отдельная область для работы с результатами.",
  ],
  [
    "06",
    "Ночной кабинет",
    "Темная среда, контрастные данные и боковая панель сравнения.",
  ],
  [
    "07",
    "Натуральная поставка",
    "Теплая бумага, оливковые акценты и мягкие формы карточек.",
  ],
  [
    "08",
    "Типографическая сетка",
    "Крупные названия, черно-белая сетка и четкие линии.",
  ],
  [
    "09",
    "Технический каталог",
    "Индустриальная графика, компактные паспорта и моноширинные подписи.",
  ],
  [
    "10",
    "Поиск прежде всего",
    "Поиск в центре внимания, короткие результаты и минимум навигации.",
  ],
];
const params = new URLSearchParams(location.search),
  sheet = params.has("sheet");
if (sheet) {
  document.body.classList.add("sheet");
  document.querySelector("h1").textContent =
    params.get("part") === "1"
      ? "Варианты 01-05"
      : params.get("part") === "2"
        ? "Варианты 06-10"
        : "10 вариантов дизайна";
}
const list =
  params.get("part") === "1"
    ? concepts.slice(0, 5)
    : params.get("part") === "2"
      ? concepts.slice(5)
      : concepts;
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
for (const [number, name, description] of list) {
  const card = el("article", "concept-card");
  card.id = `variant-${number}`;
  const title = el("div", "concept-title");
  title.append(el("span", "concept-number", number), el("h2", "", name));
  const anchor = el("a", "preview-link");
  anchor.href = `./${number}.html`;
  anchor.target = "_blank";
  anchor.rel = "noopener";
  anchor.setAttribute("aria-label", `Открыть ${number}: ${name}`);
  const img = el("img");
  img.src = `./shots/${number}.png`;
  img.alt = `Вариант ${number}. ${name}`;
  img.width = 1440;
  img.height = 900;
  anchor.append(img);
  const footer = el("div", "concept-footer"),
    open = el("a", "open-link", "Открыть на полный экран");
  open.href = `./${number}.html`;
  open.target = "_blank";
  open.rel = "noopener";
  footer.append(el("p", "", description), open);
  card.append(title, anchor, footer);
  document.getElementById("gallery").append(card);
  const jump = el("a", "", number);
  jump.href = `#variant-${number}`;
  document.getElementById("jump-nav").append(jump);
}
document.getElementById("view-toggle").addEventListener("click", (event) => {
  const large = document.getElementById("gallery").classList.toggle("large");
  event.currentTarget.setAttribute("aria-pressed", String(large));
  event.currentTarget.textContent = large ? "Общий обзор" : "Крупные превью";
});
document.body.dataset.ready = "true";
