export const categories = {
  ingredients: "Ингредиенты",
  finished: "Готовая продукция",
  packaging: "Упаковка",
};
export const normalize = (value) =>
  String(value).toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
const regionKey = (value) =>
  normalize(value)
    .replace(/^г\.\s*/, "")
    .replace(/\s+/g, " ");
// Покрытие области включает город, обратное утверждение недопустимо.
const cityRegions = {
  новосибирск: "новосибирская область",
  екатеринбург: "свердловская область",
  краснодар: "краснодарский край",
  воронеж: "воронежская область",
  самара: "самарская область",
  волгоград: "волгоградская область",
  астрахань: "астраханская область",
  "нижний новгород": "нижегородская область",
  уфа: "республика башкортостан",
  казань: "республика татарстан",
};
export function deliveryMatch(supplier, region = "") {
  const key = regionKey(region);
  if (!key) return { scope: "all", entries: supplier.delivery };
  const regional = supplier.delivery.filter((d) => {
    const entry = regionKey(d.region);
    return entry !== "россия" && (entry === key || entry === cityRegions[key]);
  });
  if (regional.length) return { scope: "regional", entries: regional };
  const national = supplier.delivery.filter(
    (d) => regionKey(d.region) === "россия",
  );
  return { scope: national.length ? "national" : "none", entries: national };
}
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
        (!region || deliveryMatch(s, region).scope !== "none") &&
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
      const match = deliveryMatch(s, region);
      return {
        s,
        score,
        rank: region && match.scope === "national" ? 1 : 0,
        matches: tokens.every((t) => haystack.includes(t)),
      };
    })
    .filter((r) => r.matches)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        b.score - a.score ||
        a.s.name.localeCompare(b.s.name, "ru"),
    )
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
