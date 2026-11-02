import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  money,
  deliveryRates,
  deliverySummary,
  supplierNuances,
} from "../public/terms.js";
const data = JSON.parse(
    await readFile(
      new URL("../public/data/catalog.json", import.meta.url),
      "utf8",
    ),
  ),
  get = (id) => data.find((s) => s.id === id);
test("неизвестная цена отличается от бесплатной", () => {
  assert.equal(money(null), "Не опубликовано");
  assert.equal(money(undefined), "Не опубликовано");
  assert.equal(money(0), "0 ₽");
});
test("тариф выбирается для региона доставки", () => {
  const rates = deliveryRates(get("geovita"), "Москва");
  assert.equal(rates.length, 2);
  assert(rates.every((r) => r.region === "Москва"));
  assert.equal(rates.find((r) => r.min === 790).max, null);
  assert.deepEqual(deliveryRates(get("geovita"), "Новосибирск"), []);
  assert.deepEqual(deliveryRates(get("geovita"), "Россия"), []);
});
test("порог бесплатной доставки и платный вариант не смешиваются", () => {
  const rates = deliveryRates(get("geovita"), "Санкт-Петербург");
  assert.deepEqual(
    rates.map((r) => [r.min, r.max]),
    [
      [0, 0],
      [790, 790],
    ],
  );
  assert(rates[0].conditions.includes("10 000"));
  assert(
    deliverySummary(get("geovita"), "Санкт-Петербург").includes("2 вариантов"),
  );
});
test("опубликованный фиксированный тариф и отсутствие цены", () => {
  assert.deepEqual(
    deliveryRates(get("sibirskiy-produkt-nsk"), "Новосибирск").map((r) => [
      r.min,
      r.max,
    ]),
    [[305, 305]],
  );
  assert(deliverySummary(get("likhachevsky")).includes("уточни"));
});
test("нюансы сохраняют ограничения и ссылки", () => {
  const notes = supplierNuances(get("tasty-coffee"));
  assert(notes.some((n) => n.text.includes("удаленных")));
  assert(notes.every((n) => n.sourceUrl.startsWith("https://")));
  assert(
    supplierNuances(get("ekor")).some((n) => n.text.includes("разные пороги")),
  );
});
test("цена товара привязана к позиции и единице, противоречия не дают диапазон", () => {
  const p = get("likhachevsky").price;
  assert.equal(p.min, 99);
  assert.equal(p.max, null);
  assert.equal(p.unit, "упаковка 0,5 кг");
  const conflict = get("aqvatoriy-nsk").price;
  assert.equal(conflict.min, null);
  assert.equal(conflict.max, null);
  assert(conflict.conditions.includes("разные цены"));
});
