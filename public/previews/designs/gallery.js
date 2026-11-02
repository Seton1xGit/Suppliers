import { designs, designNumber } from "/designs.js";
const descriptions = [
  "Условия нескольких поставщиков видны одновременно.",
  "Строгая сетка и фильтры слева.",
  "Навигация и область для работы с результатами.",
  "Темное оформление и боковая панель сравнения.",
  "Крупные названия и четкие линии.",
  "Компактные паспорта компаний.",
  "Поиск в центре внимания.",
];
export const concepts = designs.map(([id, name], i) => [
  designNumber(id),
  name,
  descriptions[i],
]);
const params = new URLSearchParams(location.search),
  sheet = params.has("sheet");
if (sheet) {
  document.body.classList.add("sheet");
  document.querySelector("h1").textContent =
    params.get("part") === "1"
      ? "Варианты 01-05"
      : params.get("part") === "2"
        ? "Варианты 06-07"
        : "7 вариантов дизайна";
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
