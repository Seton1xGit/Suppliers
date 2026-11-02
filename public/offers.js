import { deliveryMatch } from "./regions.js";

const normalize = (value) =>
  String(value || "")
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е")
    .trim();
export const tomatoGroups = {
  regular: "Красные / обычные",
  vine: "На ветке",
  pink: "Розовые",
  cherry: "Черри",
  plum: "Сливовидные",
  yellow: "Желтые",
  unspecified: "Вид не уточнен",
};
export const marketLabels = {
  b2b: "Опт / B2B",
  retail: "Розница",
  unknown: "Тип продажи не указан",
};
export function queryProduct(query) {
  const q = normalize(query);
  if (!q) return null;
  if (/(помидор|томат|черри)/.test(q)) {
    if (
      /(семен|рассад|кетчуп|сок|паст[ауы]|соус|консерв|маринов|солен|вялен|сушен|заморож|порош)/.test(
        q,
      )
    )
      return null;
    const group = /черри/.test(q)
      ? "cherry"
      : /розов/.test(q)
        ? "pink"
        : /слив(ка|овид|ки)/.test(q)
          ? "plum"
          : /желт/.test(q)
            ? "yellow"
            : /ветк/.test(q)
              ? "vine"
              : /красн|обычн/.test(q)
                ? "regular"
                : "all";
    return { family: "fresh-tomato", group };
  }
  if (/слоен.*тест|тест.*слоен/.test(q) || q === "тесто")
    return { family: "puff-dough", group: "puff-dough" };
  if (/васаби/.test(q)) return { family: "wasabi", group: "wasabi" };
  return null;
}
export function activeGroup(filters) {
  const product = queryProduct(filters.query);
  return product
    ? filters.offerGroup && filters.offerGroup !== "auto"
      ? filters.offerGroup
      : product.group
    : null;
}
export function hasPublishedPrice(offer) {
  return (
    !!offer &&
    ["exact", "from", "range"].includes(offer.price.type) &&
    Number.isFinite(offer.price.min) &&
    offer.price.min >= 0 &&
    (offer.price.type !== "range" ||
      (Number.isFinite(offer.price.max) && offer.price.max >= offer.price.min))
  );
}
export function normalizedPrice(offer) {
  if (!hasPublishedPrice(offer) || offer.price.currency !== "RUB") return null;
  const weight = offer.price.unit === "kg" ? 1 : offer.price.weightPerUnitKg;
  if (!Number.isFinite(weight) || weight <= 0) return null;
  return {
    min: offer.price.min / weight,
    max:
      offer.price.type === "exact"
        ? offer.price.min / weight
        : Number.isFinite(offer.price.max)
          ? offer.price.max / weight
          : null,
    unit: "кг",
    type: offer.price.type,
  };
}
export function offerEligible(offer, region = "") {
  if (!region) return true;
  return (
    deliveryMatch(
      {
        delivery: offer.fulfillment.deliveryRegions.map((region) => ({
          region,
        })),
      },
      region,
    ).scope !== "none"
  );
}
export function matchingOffers(supplierId, offers, filters = {}) {
  const product = queryProduct(filters.query),
    group = activeGroup(filters);
  if (!product) return [];
  return offers.filter(
    (o) =>
      o.supplierId === supplierId &&
      o.family === product.family &&
      (product.family !== "fresh-tomato" || o.form === "fresh") &&
      (group === "all" || o.group === group) &&
      offerEligible(o, filters.region),
  );
}
export function comparisonKey(offer) {
  if (!hasPublishedPrice(offer)) return "no-price";
  if (!normalizedPrice(offer)) return `unit-unknown:${offer.id}`;
  return [
    offer.family,
    offer.group,
    offer.market,
    offer.vat.status,
    offer.price.type,
    offer.volumeTier || "base",
  ].join(":");
}
const groupRank = (offer) => {
  const groups = Object.keys(tomatoGroups);
  return Math.max(0, groups.indexOf(offer.group));
};
export function compareOffers(a, b, sort = "asc") {
  const known = Number(hasPublishedPrice(b)) - Number(hasPublishedPrice(a));
  if (known) return known;
  if (!a || !b) return 0;
  const grouped =
    groupRank(a) - groupRank(b) ||
    ["b2b", "retail", "unknown"].indexOf(a.market) -
      ["b2b", "retail", "unknown"].indexOf(b.market) ||
    Number(!normalizedPrice(a)) - Number(!normalizedPrice(b));
  if (grouped) return grouped;
  const keyA = comparisonKey(a),
    keyB = comparisonKey(b);
  if (keyA !== keyB) return keyA.localeCompare(keyB, "ru");
  const left = normalizedPrice(a),
    right = normalizedPrice(b);
  if (left && right && sort !== "priced")
    return (left.min - right.min) * (sort === "desc" ? -1 : 1);
  return 0;
}
export function selectedOffer(supplierId, offers, filters = {}) {
  const matches = matchingOffers(supplierId, offers, filters);
  const preferred = matches.find((o) =>
    (filters.offerIds || []).includes(o.id),
  );
  return (
    preferred ||
    matches.sort((a, b) => compareOffers(a, b, filters.priceSort))[0] ||
    null
  );
}
const number = (value) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
export function priceText(offer, normalized = true) {
  if (!hasPublishedPrice(offer)) return "Цена по запросу";
  const price = normalized ? normalizedPrice(offer) : null;
  const min = price?.min ?? offer.price.min,
    max = price?.max ?? offer.price.max;
  const unit = price
    ? "кг"
    : {
        kg: "кг",
        pack: "упаковку",
        piece: "шт.",
        unknown: "единица не указана",
      }[offer.price.unit];
  return `${offer.price.type === "from" ? "от " : ""}${number(min)}${offer.price.type === "range" && Number.isFinite(max) ? ` - ${number(max)}` : ""} ₽ / ${unit}`;
}
export function offerGroupLabel(offer) {
  if (!offer) return "Цена по запросу";
  const type =
    offer.price.type === "from"
      ? "Начальная цена, от"
      : offer.price.type === "range"
        ? "Диапазон"
        : "Опубликованная цена";
  return `${tomatoGroups[offer.group] || offer.group} / ${marketLabels[offer.market]} / ${normalizedPrice(offer) ? type : "Единица цены требует уточнения"}${offer.vat.status === "excluded" ? " / Без НДС" : offer.vat.status === "included" ? " / С НДС" : " / НДС не указан"}`;
}
