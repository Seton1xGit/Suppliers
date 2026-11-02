export const designs = [
  ["01", "Деловой реестр"],
  ["02", "B2B-маркет"],
  ["03", "Таблица закупщика"],
  ["04", "Гастрономический журнал"],
  ["05", "Рабочее приложение"],
  ["06", "Ночной кабинет"],
  ["07", "Натуральная поставка"],
  ["08", "Типографическая сетка"],
  ["09", "Технический каталог"],
  ["10", "Поиск прежде всего"],
];
export function normalizeDesign(value) {
  const key = String(value ?? "").padStart(2, "0");
  return designs.some(([id]) => id === key) ? key : "03";
}
export function initialDesign(search, saved) {
  const params = new URLSearchParams(search);
  return normalizeDesign(params.has("design") ? params.get("design") : saved);
}
