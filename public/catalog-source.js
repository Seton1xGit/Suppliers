export const categories = {
  ingredients: "Ингредиенты",
  finished: "Готовая продукция",
  packaging: "Упаковка",
};
export const normalize = (value) =>
  String(value).toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
export function searchCatalog(
  items,
  {
    query = "",
    category = "",
    region = "",
    savedOnly = false,
    saved = [],
  } = {},
) {
  const q = normalize(query),
    tokens = q.split(/\s+/).filter(Boolean);
  return items
    .filter(
      (s) =>
        (!category || s.category === category) &&
        (!region ||
          s.delivery.some(
            (d) => d.region === region || d.region === "Россия",
          )) &&
        (!savedOnly || saved.includes(s.id)),
    )
    .map((s) => {
      const products = s.products.map(normalize),
        name = normalize(s.name);
      const haystack = normalize(
        [s.name, ...s.products, ...s.synonyms, s.city].join(" "),
      );
      const score = !q
        ? 0
        : products.includes(q)
          ? 100
          : products.some((p) => p.includes(q))
            ? 80
            : name.includes(q)
              ? 60
              : 20;
      return { s, score, matches: tokens.every((t) => haystack.includes(t)) };
    })
    .filter((r) => r.matches)
    .sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name, "ru"))
    .map((r) => r.s);
}
export class JsonCatalogSource {
  constructor(url = "./data/catalog.json") {
    this.url = url;
  }
  async load() {
    const response = await fetch(this.url);
    if (!response.ok) throw new Error("Каталог недоступен");
    return response.json();
  }
  search(items, filters) {
    return searchCatalog(items, filters);
  }
}
