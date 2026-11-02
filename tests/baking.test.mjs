import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { searchCatalog, deliveryMatch } from "../public/catalog-source.js";
const data = JSON.parse(
  await readFile(
    new URL("../public/data/catalog.json", import.meta.url),
    "utf8",
  ),
);
test("добавлено пять компаний по тесту, выпечке и ингредиентам", () => {
  assert.equal(data.length, 105);
  assert.deepEqual(
    data.slice(75, 80).map((s) => s.id),
    ["likhachevsky", "jambo", "frostmo", "cake-me", "lesaffre"],
  );
});
for (const [query, ids] of [
  ["тесто", ["likhachevsky", "jambo", "frostmo"]],
  ["слоеное тесто", ["likhachevsky", "jambo", "frostmo"]],
  ["тесто для пиццы", ["jambo"]],
  ["круассаны", ["likhachevsky", "jambo", "frostmo"]],
  ["десерты", ["cake-me", "frostmo"]],
  ["дрожжи", ["lesaffre"]],
  ["закваски", ["lesaffre"]],
])
  test(`${query}: подтвержденный ассортимент`, () => {
    const found = searchCatalog(data, { query }).map((s) => s.id);
    for (const id of ids) assert(found.includes(id), id);
  });
test("ингредиенты для теста не подменяют поставку самого теста", () => {
  assert(
    !searchCatalog(data, { query: "тесто" }).some((s) => s.id === "lesaffre"),
  );
  assert(
    !searchCatalog(data, { query: "тесто" }).some((s) => s.id === "cake-me"),
  );
});
test("самовывоз не становится доставкой, у десертов есть доставка по городу", () => {
  assert.equal(
    deliveryMatch(
      data.find((s) => s.id === "likhachevsky"),
      "Новосибирск",
    ).scope,
    "none",
  );
  assert.equal(
    deliveryMatch(
      data.find((s) => s.id === "cake-me"),
      "Новосибирск",
    ).scope,
    "regional",
  );
  assert.equal(
    deliveryMatch(
      data.find((s) => s.id === "frostmo"),
      "Новосибирск",
    ).scope,
    "national",
  );
});
