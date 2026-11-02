import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { searchCatalog } from "../public/catalog-source.js";
const data = JSON.parse(
  await readFile(
    new URL("../public/data/catalog.json", import.meta.url),
    "utf8",
  ),
);
test("добавлено ровно 20 екатеринбургских компаний во всех сегментах", () => {
  const added = data.slice(80, 100);
  assert.equal(added.length, 20);
  assert(added.every((s) => s.city === "Екатеринбург"));
  assert.equal(added.filter((s) => s.category === "ingredients").length, 7);
  assert.equal(added.filter((s) => s.category === "finished").length, 6);
  assert.equal(added.filter((s) => s.category === "packaging").length, 7);
  for (const s of added)
    assert(
      searchCatalog(data, { query: s.name }).some((found) => found.id === s.id),
    );
});
test("город компании и доставка не смешиваются", () => {
  const withoutDelivery = data.slice(80, 100).filter((s) => !s.delivery.length);
  assert(withoutDelivery.length > 0);
  for (const s of withoutDelivery)
    assert(
      !searchCatalog(data, { region: "Екатеринбург" }).some(
        (found) => found.id === s.id,
      ),
    );
});
