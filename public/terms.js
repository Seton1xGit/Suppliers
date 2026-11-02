import { deliveryMatch } from "./catalog-source.js";
export const money = (value) =>
  value === null || value === undefined
    ? "Не опубликовано"
    : `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
export function deliveryRates(supplier, region = "") {
  return deliveryMatch({ delivery: supplier.deliveryRates || [] }, region)
    .entries;
}
export function deliverySummary(supplier, region = "") {
  const rates = deliveryRates(supplier, region);
  if (!rates.length) return "Стоимость доставки: уточни у поставщика";
  if (rates.length > 1)
    return `Стоимость доставки: ${rates.length} вариантов. Тарифы и ограничения в карточке.`;
  return rates
    .map(
      (rate) =>
        `${rate.region}: минимум ${money(rate.min)}, максимум ${money(rate.max)}. ${rate.conditions}`,
    )
    .join(" ");
}
export function supplierNuances(supplier, region = "") {
  const result = (supplier.conditions || []).map((note) => ({ ...note }));
  for (const entry of deliveryMatch(supplier, region).entries)
    result.push({ text: entry.evidence, sourceUrl: entry.sourceUrl });
  for (const rate of deliveryRates(supplier, region))
    result.push({
      text: `${rate.region}: ${rate.conditions}`,
      sourceUrl: rate.sourceUrl,
    });
  for (const key of ["minimumOrder", "documents"])
    if (supplier[key])
      result.push({
        text: supplier[key].evidence,
        sourceUrl: supplier[key].sourceUrl,
      });
  if (supplier.price)
    result.push({
      text: `${supplier.price.product}, ${supplier.price.unit}. ${supplier.price.conditions}`,
      sourceUrl: supplier.price.sourceUrl,
    });
  const seen = new Set();
  return result.filter((note) => !seen.has(note.text) && seen.add(note.text));
}
