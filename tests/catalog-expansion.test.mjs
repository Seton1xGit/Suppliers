import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { searchCatalog, productMatch } from "../public/catalog-source.js";
const data = JSON.parse(
  await readFile(
    new URL("../public/data/catalog.json", import.meta.url),
    "utf8",
  ),
);
const marine = [
  "aqvatoriy-nsk",
  "resfood",
  "oshi-cosmos",
  "virtex-food",
  "global-foods",
  "anfish",
  "fishman",
  "roy-import",
  "farwater",
  "ultrafish",
  "kit-tk",
  "prichal-fish",
  "baltic-coast",
  "meridian",
  "vici",
];
const other = [
  "tasty-coffee",
  "russian-tea-company",
  "agro-alliance",
  "aidigo",
  "semushka",
  "damate",
  "garnec",
  "hi-food",
  "honey-house",
  "russian-cold",
  "blago",
  "fruktline",
  "borovskaya",
  "belaya-dacha",
  "td-yarmarka",
];
test("морская подборка и остальные новые направления сохранены", () => {
  assert.equal(data.length, 100);
  assert.deepEqual(
    new Set(data.slice(45, 75).map((s) => s.id)),
    new Set([...marine, ...other]),
  );
  assert.equal(data.filter((s) => s.category === "ingredients").length, 49);
  assert.equal(data.filter((s) => s.category === "finished").length, 32);
  assert.equal(data.filter((s) => s.category === "packaging").length, 19);
});
for (const [q, id] of [
  ["суши", "aqvatoriy-nsk"],
  ["нори", "resfood"],
  ["тобико", "oshi-cosmos"],
  ["треска", "anfish"],
  ["рыба", "ultrafish"],
  ["креветки", "roy-import"],
  ["кофе", "tasty-coffee"],
  ["чай", "russian-tea-company"],
  ["нут", "agro-alliance"],
  ["куркума", "aidigo"],
  ["курага", "semushka"],
  ["индейка", "damate"],
  ["безглютеновая мука", "garnec"],
  ["растительный фарш", "hi-food"],
  ["мед", "honey-house"],
  ["пломбир", "russian-cold"],
  ["подсолнечное масло", "blago"],
  ["помидоры", "fruktline"],
  ["яйцо", "borovskaya"],
  ["руккола", "belaya-dacha"],
  ["горох", "td-yarmarka"],
])
  test(`${q}: ${id}`, () =>
    assert(searchCatalog(data, { query: q }).some((s) => s.id === id)));
test("контакты и источники новых компаний доступны в записях", () => {
  for (const id of [...marine, ...other]) {
    const s = data.find((s) => s.id === id);
    assert(s.contacts.some((c) => /^(tel:|mailto:|https:)/.test(c.url)));
    assert(s.sources.length > 0);
    assert(s.sources.every((source) => /^https:\/\//.test(source.url)));
    assert.equal(s.verifiedAt, "2026-11-02");
  }
});
test("сведения об офисе не превращаются в доставку", () => {
  for (const id of [
    "virtex-food",
    "prichal-fish",
    "meridian",
    "vici",
    "damate",
    "borovskaya",
    "belaya-dacha",
    "russian-cold",
  ])
    assert.deepEqual(data.find((s) => s.id === id).delivery, []);
});
test("морской ассортимент не выдается за любой вид рыбы", () => {
  assert.equal(
    productMatch(
      data.find((s) => s.id === "roy-import"),
      "треска",
    ).related.kind,
    "group",
  );
  assert.equal(
    productMatch(
      data.find((s) => s.id === "vici"),
      "треска",
    ).matches,
    false,
  );
});
