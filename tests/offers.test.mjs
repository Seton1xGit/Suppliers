import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  queryProduct,
  activeGroup,
  matchingOffers,
  selectedOffer,
  normalizedPrice,
  hasPublishedPrice,
  priceText,
  comparisonKey,
  compareOffers,
  offerEligible,
} from "../public/offers.js";
import { searchCatalog } from "../public/catalog-source.js";
import { validate } from "../scripts/validate.mjs";
const load = async (name) =>
  JSON.parse(
    await readFile(
      new URL(`../public/data/${name}.json`, import.meta.url),
      "utf8",
    ),
  );
const data = await load("catalog"),
  offers = await load("manual-offers");
const get = (id) => offers.find((o) => o.id === id);
const fixture = (price, extra = {}) => ({
  ...structuredClone(get("kalinbaza-red-kg")),
  ...extra,
  price: { ...get("kalinbaza-red-kg").price, ...price },
});
test("предложения связаны с компаниями и проверяемыми источниками", () =>
  validate(data, offers));
for (const q of ["помидор", "помидоры", "томат", "томаты", "свежие помидоры"])
  test(`${q}: свежий товар`, () =>
    assert.equal(queryProduct(q).family, "fresh-tomato"));
for (const q of [
  "томатная паста",
  "томатный сок",
  "семена томатов",
  "рассада помидоров",
  "маринованные помидоры",
  "вяленые томаты",
  "томатный соус",
  "замороженные томаты",
])
  test(`${q}: цена свежих томатов не подставляется`, () =>
    assert.equal(queryProduct(q), null));
for (const [q, g] of [
  ["черри", "cherry"],
  ["розовые помидоры", "pink"],
  ["томаты сливовидные", "plum"],
  ["томаты на ветке", "vine"],
])
  test(`${q}: отдельный вид`, () =>
    assert.equal(activeGroup({ query: q, offerGroup: "auto" }), g));
test("выбор вида не смешивает черри с обычными", () => {
  const filters = { query: "помидоры", offerGroup: "cherry" };
  assert(
    matchingOffers("sofiiskaya-baza", offers, filters).every(
      (o) => o.group === "cherry",
    ),
  );
  assert.equal(
    selectedOffer("sofiiskaya-baza", offers, filters).price.min,
    352,
  );
  assert.equal(selectedOffer("likhachevsky", offers, filters), null);
  assert.equal(selectedOffer("aqvatoriy-nsk", offers, filters), null);
});
test("подтвержденный ящик 7 кг нормализуется, исходная цена остается", () => {
  const o = get("kalinbaza-red-box");
  assert.equal(o.price.min, 2093);
  assert.equal(normalizedPrice(o).min, 299);
  assert.equal(
    priceText(o, false).replaceAll("\u00a0", " "),
    "2 093 ₽ / упаковку",
  );
});
test("начальная цена сохраняет от и неизвестный максимум", () => {
  assert.equal(priceText(get("food-fresh-pink")), "от 378 ₽ / кг");
  assert.equal(normalizedPrice(get("food-fresh-pink")).max, null);
  assert.equal(priceText(get("likhachevsky-legacy-product")), "от 198 ₽ / кг");
});
test("диапазон относится к одному предложению и единице", () => {
  const o = fixture({
    type: "range",
    min: 100,
    max: 140,
    unit: "pack",
    weightPerUnitKg: 2,
  });
  assert.deepEqual(normalizedPrice(o), {
    min: 50,
    max: 70,
    unit: "кг",
    type: "range",
  });
  assert.equal(priceText(o), "50 - 70 ₽ / кг");
  assert.equal(
    hasPublishedPrice(fixture({ type: "range", min: 140, max: 100 })),
    false,
  );
});
test("неизвестная единица и вес не превращаются в дешевый килограмм", () => {
  assert.equal(normalizedPrice(get("food-fresh-bunch")), null);
  assert.equal(normalizedPrice(get("food-fresh-cherry")), null);
  assert.equal(
    normalizedPrice(fixture({ unit: "pack", weightPerUnitKg: null })),
    null,
  );
  assert(priceText(get("food-fresh-plum")).includes("единица не указана"));
});
test("неизвестная или противоречивая цена не равна нулю", () => {
  assert.equal(normalizedPrice(get("aqvatoriy-nsk-legacy-product")), null);
  assert.equal(hasPublishedPrice(get("aqvatoriy-nsk-legacy-product")), false);
  assert.equal(priceText(null), "Цена по запросу");
  assert.equal(normalizedPrice(null), null);
});
test("опт и розница не ранжируются как одна группа", () => {
  const retail = get("fermermart-red"),
    b2b = get("sofiiskaya-red");
  assert.notEqual(comparisonKey(retail), comparisonKey(b2b));
  assert(compareOffers(b2b, retail, "asc") < 0);
});
test("НДС, ступени и тип начальной цены сохраняют разные группы", () => {
  const o = get("sofiiskaya-red");
  assert.notEqual(
    comparisonKey(o),
    comparisonKey({ ...o, vat: { status: "included" } }),
  );
  assert.notEqual(
    comparisonKey(o),
    comparisonKey({ ...o, volumeTier: "1000kg" }),
  );
  assert.notEqual(comparisonKey(o), comparisonKey(fixture({ type: "from" })));
});
test("цена определяет порядок внутри совместимой группы", () => {
  const f = {
    query: "помидоры",
    offerGroup: "regular",
    offers,
    priceOnly: true,
  };
  const b2b = (mode) =>
    searchCatalog(data, { ...f, priceSort: mode })
      .filter((s) => selectedOffer(s.id, offers, f).market === "b2b")
      .map((s) => s.id);
  assert.deepEqual(b2b("asc"), ["sofiiskaya-baza", "kalinbaza", "food-star"]);
  assert.deepEqual(b2b("desc"), ["food-star", "kalinbaza", "sofiiskaya-baza"]);
});
test("регион остается жестким ограничением цены и компании", () => {
  const f = {
    query: "помидоры",
    offerGroup: "regular",
    offers,
    priceOnly: true,
    region: "Екатеринбург",
  };
  assert.deepEqual(
    searchCatalog(data, f).map((s) => s.id),
    ["fermermart-ekb"],
  );
  assert.equal(offerEligible(get("food-star-mahitos"), "Новосибирск"), false);
  assert.deepEqual(searchCatalog(data, { ...f, region: "Новосибирск" }), []);
});
test("самовывоз не становится доставкой", () => {
  const o = fixture(
    {},
    {
      fulfillment: {
        ...get("kalinbaza-red-kg").fulfillment,
        deliveryRegions: [],
        pickupRegions: ["Москва"],
      },
    },
  );
  assert.equal(offerEligible(o, "Москва"), false);
  assert.equal(offerEligible(o, ""), true);
});
test("для другого товара не подставляются томаты", () => {
  assert.equal(selectedOffer("food-star", offers, { query: "бананы" }), null);
  assert.deepEqual(
    searchCatalog(data, { query: "бананы", offers, priceOnly: true }),
    [],
  );
});
test("конкретное предложение сохраняется только в подходящем виде", () => {
  const f = {
    query: "помидоры",
    offerGroup: "regular",
    offerIds: ["kalinbaza-red-box"],
  };
  assert.equal(selectedOffer("kalinbaza", offers, f).id, "kalinbaza-red-box");
  assert.equal(
    selectedOffer("kalinbaza", offers, { ...f, offerGroup: "cherry" }),
    null,
  );
});
