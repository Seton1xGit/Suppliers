import { relatedProductMatch } from "./product-search.js";
import { selectedOffer, compareOffers, hasPublishedPrice } from "./offers.js";
export const categories = {
  ingredients: "Ингредиенты",
  finished: "Готовая продукция",
  packaging: "Упаковка",
};
export const normalize = (value) =>
  String(value).toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
export { deliveryMatch } from "./regions.js";
import { deliveryMatch } from "./regions.js";
export function productMatch(supplier, query = "") {
  const q = normalize(query),
    tokens = q.split(/\s+/).filter(Boolean);
  const products = supplier.products.map(normalize);
  const haystack = normalize(
    [
      supplier.name,
      ...supplier.products,
      ...supplier.synonyms,
      supplier.city,
    ].join(" "),
  );
  if (tokens.every((t) => haystack.includes(t)))
    return {
      matches: true,
      score: !q
        ? 0
        : products.includes(q)
          ? 100
          : products.some((p) => p.includes(q))
            ? 80
            : normalize(supplier.name).includes(q)
              ? 60
              : 20,
    };
  const related = relatedProductMatch(supplier, q);
  return related
    ? { matches: true, score: related.kind === "alias" ? 70 : 10, related }
    : { matches: false, score: 0 };
}
export function searchCatalog(
  items,
  {
    query = "",
    category = "",
    region = "",
    savedOnly = false,
    saved = [],
    offers = [],
    offerGroup = "auto",
    offerIds = [],
    priceSort = "asc",
    priceOnly = false,
  } = {},
) {
  return items
    .filter(
      (s) =>
        (!category || s.category === category) &&
        (!region || deliveryMatch(s, region).scope !== "none") &&
        (!savedOnly || saved.includes(s.id)),
    )
    .map((s) => {
      const result = productMatch(s, query);
      const match = deliveryMatch(s, region);
      const offer = selectedOffer(s.id, offers, {
        query,
        region,
        offerGroup,
        offerIds,
        priceSort,
      });
      return {
        s,
        offer,
        score: result.score,
        rank: region && match.scope === "national" ? 1 : 0,
        matches: result.matches,
      };
    })
    .filter((r) => r.matches && (!priceOnly || hasPublishedPrice(r.offer)))
    .sort(
      (a, b) =>
        compareOffers(a.offer, b.offer, priceSort) ||
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
