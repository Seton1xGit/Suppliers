import {
  queryProduct,
  matchingOffers,
  selectedOffer,
  hasPublishedPrice,
  normalizedPrice,
  priceText,
  marketLabels,
  tomatoGroups,
} from "./offers.js";

const date = (value) => value.split("-").reverse().join(".");
export function detailOffer(supplier, offers, filters) {
  const match = selectedOffer(supplier.id, offers, filters);
  if (match || queryProduct(filters.query)) return match;
  const q = filters.query.toLocaleLowerCase("ru").trim();
  return !q || supplier.name.toLocaleLowerCase("ru").includes(q)
    ? offers.find((o) => o.supplierId === supplier.id)
    : null;
}
export function createOfferBlock(
  supplier,
  offers,
  filters,
  { el, link, onSelect, detail = false },
) {
  const block = el("div", "offer-block");
  const offer = detail
    ? detailOffer(supplier, offers, filters)
    : selectedOffer(supplier.id, offers, filters);
  block.dataset.offerId = offer?.id || "";
  block.dataset.hasPrice = String(hasPublishedPrice(offer));
  if (!offer) {
    block.append(
      el("span", "offer-label", "Цена искомого товара"),
      el(
        "strong",
        "price-amount no-price",
        filters.query ? "Цена по запросу" : "Введи товар для поиска цены",
      ),
    );
    if (filters.query)
      block.append(
        el("p", "price-status", "Цена не найдена в каталоге. Уточни у поставщика"),
      );
    return block;
  }
  const normalized = normalizedPrice(offer);
  block.append(
    el(
      "span",
      "offer-label",
      tomatoGroups[offer.group] || "Товарное предложение",
    ),
    el("b", "offer-name", offer.name),
    el("strong", "price-amount", priceText(offer)),
  );
  const original =
    offer.price.unit !== "kg" && normalized
      ? `${priceText(offer, false)}. ${offer.pack.label}`
      : offer.pack.label;
  block.append(
    el("p", "offer-original", original),
    el("p", "offer-market", `${marketLabels[offer.market]}. ${offer.vat.text}`),
    el("p", "offer-minimum", offer.minimum.text),
  );
  if (!normalized && hasPublishedPrice(offer))
    block.append(
      el(
        "p",
        "price-caution",
        "Цена за 1 кг не рассчитана: единицу цены нужно подтвердить.",
      ),
    );
  const receiving = offer.fulfillment.deliveryRegions.length
    ? `Регион предложения: ${offer.fulfillment.deliveryRegions.join(", ")}`
    : "Доставка по этой цене не подтверждена";
  block.append(el("p", "offer-region", receiving));
  const source = el("div", "offer-provenance");
  source.append(
    link("Источник цены", offer.sourceUrl, "price-source"),
    el("span", "", `Проверено ${date(offer.verifiedAt)}`),
  );
  block.append(source);
  const details = el("details", "offer-conditions");
  details.append(el("summary", "", "Условия цены и получения"));
  details.append(el("p", "", offer.fulfillment.text));
  if (offer.fulfillment.pickupRegions.length)
    details.append(
      el(
        "p",
        "",
        `Самовывоз: ${offer.fulfillment.pickupRegions.join(", ")}. Условия и адрес согласуй отдельно.`,
      ),
    );
  details.append(
    el(
      "p",
      "",
      offer.availability === "in_stock"
        ? "На странице указано наличие. Подтверди остаток и цену перед заказом."
        : "Текущее наличие нужно подтвердить у поставщика.",
    ),
  );
  if (offer.sourceUpdatedAt)
    details.append(
      el("p", "", `Дата цены на сайте: ${date(offer.sourceUpdatedAt)}`),
    );
  for (const note of offer.notes) details.append(el("p", "", note));
  block.append(details);
  const matches = matchingOffers(supplier.id, offers, filters);
  if (matches.length > 1) {
    const label = el(
        "label",
        "offer-choice-label",
        `Предложения компании: ${matches.length}`,
      ),
      select = el("select");
    select.dataset.offerChoice = supplier.id;
    select.setAttribute("aria-label", `Выбрать товар: ${supplier.name}`);
    for (const candidate of matches) {
      const option = el(
        "option",
        "",
        `${candidate.name}: ${priceText(candidate)}`,
      );
      option.value = candidate.id;
      select.append(option);
    }
    select.value = offer.id;
    select.addEventListener("change", () =>
      onSelect(supplier.id, select.value),
    );
    label.append(select);
    block.append(label);
  }
  return block;
}
