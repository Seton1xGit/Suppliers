import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
export function validate(items, offers = []) {
  assert(items.length >= 100, "Нужно минимум 100 поставщиков");
  const ids = new Set(),
    sites = new Set(),
    names = new Set();
  const url = (s, protocols = ["https:", "http:"]) => {
    const u = new URL(s);
    assert(protocols.includes(u.protocol), `Недопустимая ссылка ${s}`);
    return u;
  };
  for (const s of items) {
    assert(/^[a-z0-9-]+$/.test(s.id));
    assert(!ids.has(s.id), `Дубль ID ${s.id}`);
    ids.add(s.id);
    assert(!names.has(s.name));
    names.add(s.name);
    for (const k of ["name", "city", "website", "verifiedAt"])
      assert(typeof s[k] === "string" && s[k].trim(), `${s.id}: ${k}`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(s.verifiedAt));
    assert(["ingredients", "finished", "packaging"].includes(s.category));
    const site = url(s.website).hostname.replace(/^www\./, "");
    assert(!sites.has(site), `Дубль сайта ${site}`);
    sites.add(site);
    for (const key of ["products", "synonyms"])
      assert(
        Array.isArray(s[key]) &&
          s[key].length &&
          s[key].every((v) => typeof v === "string" && v.trim()),
      );
    assert(s.contacts.length);
    s.contacts.forEach((c) => {
      assert(c.label);
      url(c.url, ["https:", "http:", "tel:", "mailto:"]);
    });
    assert(s.sources.length);
    s.sources.forEach((v) => {
      assert(v.label);
      url(v.url);
    });
    const sources = new Set(s.sources.map((v) => v.url));
    assert(Array.isArray(s.delivery));
    s.delivery.forEach((d) => {
      assert(d.region && d.evidence);
      url(d.sourceUrl);
      assert(
        sources.has(d.sourceUrl),
        `${s.id}: источник доставки отсутствует в sources`,
      );
    });
    for (const k of ["minimumOrder", "documents", "price"])
      if (s[k]) {
        assert(s[k].value && s[k].evidence);
        url(s[k].sourceUrl);
        assert(sources.has(s[k].sourceUrl));
      }
    const bounds = (value) => {
      for (const key of ["min", "max"])
        assert(
          value[key] === null ||
            (Number.isFinite(value[key]) && value[key] >= 0),
          `${s.id}: ${key}`,
        );
      if (value.min !== null && value.max !== null)
        assert(value.min <= value.max, `${s.id}: диапазон цен`);
      assert(value.currency === "RUB");
      assert(/^\d{4}-\d{2}-\d{2}$/.test(value.verifiedAt));
    };
    for (const rate of s.deliveryRates || []) {
      bounds(rate);
      assert(rate.region && rate.conditions && rate.evidence);
      url(rate.sourceUrl);
      assert(sources.has(rate.sourceUrl));
      assert(
        s.delivery.some((d) => d.region === rate.region),
        `${s.id}: тариф вне подтвержденного покрытия`,
      );
    }
    for (const note of s.conditions || []) {
      assert(note.text);
      url(note.sourceUrl);
      assert(sources.has(note.sourceUrl));
    }
    if (s.price) bounds(s.price);
    if (s.price)
      for (const key of ["product", "unit", "verifiedAt", "conditions"])
        assert(s.price[key], `Цена: ${key}`);
  }
  for (const c of ["ingredients", "finished", "packaging"])
    assert(items.filter((s) => s.category === c).length >= 10);
  const offerIds = new Set();
  for (const offer of offers) {
    assert(
      /^[a-z0-9-]+$/.test(offer.id) && !offerIds.has(offer.id),
      "Дубль или неверный ID предложения",
    );
    offerIds.add(offer.id);
    const supplier = items.find((s) => s.id === offer.supplierId);
    assert(supplier, `${offer.id}: компания не найдена`);
    for (const key of [
      "name",
      "family",
      "form",
      "group",
      "sourceUrl",
      "verifiedAt",
    ])
      assert(offer[key], `${offer.id}: ${key}`);
    assert(
      supplier.sources.some((source) => source.url === offer.sourceUrl),
      `${offer.id}: источник отсутствует у поставщика`,
    );
    assert(/^\d{4}-\d{2}-\d{2}$/.test(offer.verifiedAt));
    assert(
      offer.pack.label && offer.minimum.text && Array.isArray(offer.notes),
    );
    assert(["b2b", "retail", "unknown"].includes(offer.market));
    assert(
      ["included", "excluded", "unknown"].includes(offer.vat.status) &&
        offer.vat.text,
    );
    assert(
      ["in_stock", "unknown", "out_of_stock"].includes(offer.availability),
    );
    const price = offer.price;
    assert(
      price.currency === "RUB" &&
        ["exact", "from", "range", "conflict", "unknown"].includes(price.type),
    );
    assert(["kg", "pack", "piece", "unknown"].includes(price.unit));
    for (const key of ["min", "max"])
      assert(
        price[key] === null || (Number.isFinite(price[key]) && price[key] >= 0),
      );
    if (["exact", "from", "range"].includes(price.type))
      assert(Number.isFinite(price.min));
    if (price.type === "range")
      assert(Number.isFinite(price.max) && price.max >= price.min);
    if (["conflict", "unknown"].includes(price.type))
      assert(price.min === null && price.max === null);
    if (price.weightPerUnitKg !== null)
      assert(
        price.weightPerUnitKg > 0 &&
          price.weightEvidence &&
          price.unit !== "unknown",
      );
    const fulfillment = offer.fulfillment;
    assert(
      Array.isArray(fulfillment.deliveryRegions) &&
        Array.isArray(fulfillment.pickupRegions) &&
        fulfillment.text,
    );
    assert(supplier.sources.some((s) => s.url === fulfillment.sourceUrl));
    for (const region of fulfillment.deliveryRegions)
      assert(
        supplier.delivery.some((d) => d.region === region),
        `${offer.id}: цена вне подтвержденной доставки`,
      );
  }
  return `${items.length} компаний, ${offers.length} товарных предложений, контакты, источники и условия проверены`;
}
if (process.argv[1]?.endsWith("validate.mjs"))
  console.log(
    validate(
      JSON.parse(
        await readFile(
          new URL("../public/data/catalog.json", import.meta.url),
          "utf8",
        ),
      ),
      JSON.parse(
        await readFile(
          new URL("../public/data/offers.json", import.meta.url),
          "utf8",
        ),
      ),
    ),
  );
