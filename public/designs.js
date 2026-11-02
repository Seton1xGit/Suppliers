export const designs = [
  ["table", "Таблица закупщика"],
  ["registry", "Деловой реестр"],
  ["workspace", "Рабочее приложение"],
  ["dark", "Ночной кабинет"],
  ["type", "Типографическая сетка"],
  ["technical", "Технический каталог"],
  ["search", "Поиск прежде всего"],
];
const legacy = {
  "01": "registry",
  "03": "table",
  "05": "workspace",
  "06": "dark",
  "08": "type",
  "09": "technical",
  10: "search",
};
export function designNumber(id) {
  return String(designs.findIndex(([key]) => key === id) + 1).padStart(2, "0");
}
export function designLayout(id) {
  return Object.keys(legacy).find((key) => legacy[key] === id) || "03";
}
export function normalizeDesign(value) {
  const key = String(value ?? "");
  return designs.some(([id]) => id === key)
    ? key
    : legacy[key.padStart(2, "0")] || "table";
}
export function initialDesign(search, saved) {
  const params = new URLSearchParams(search);
  return normalizeDesign(params.has("design") ? params.get("design") : saved);
}
