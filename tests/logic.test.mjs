import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  normalize,
  searchCatalog,
  deliveryMatch,
} from "../public/catalog-source.js";
import { nationalIds, regionalIds, expectedIds } from "./region-fixtures.mjs";
import { createSavedStore } from "../public/storage.js";
import { designs, normalizeDesign, initialDesign } from "../public/designs.js";
import { validate } from "../scripts/validate.mjs";
const data = JSON.parse(
  await readFile(
    new URL("../public/data/catalog.json", import.meta.url),
    "utf8",
  ),
);
test("каталог соответствует схеме и не содержит дублей", () => validate(data));
test("оформление: основной 01, URL приоритетнее сохраненного, неизвестный дает таблицу", () => {
  assert.equal(designs.length, 7);
  assert.equal(initialDesign("", undefined), "table");
  assert.equal(initialDesign("", "06"), "dark");
  assert.equal(initialDesign("?design=registry&q=стакан", "06"), "registry");
  assert.equal(initialDesign("?design=unknown", "06"), "table");
  assert.equal(normalizeDesign("3"), "table");
});
test("старое сохранение получает таблицу без потери ID и заметок", () => {
  const saved = {
    saved: ["7-verst"],
    notes: { "7-verst": "Запросить прайс" },
    compare: ["7-verst"],
  };
  const store = createSavedStore(() => ({
    getItem: () => JSON.stringify(saved),
    setItem() {},
    removeItem() {},
  }));
  assert.equal(store.state.design, "table");
  assert.deepEqual(store.state.saved, saved.saved);
  assert.deepEqual(store.state.notes, saved.notes);
});
test("сохраненное оформление читается из того же состояния", () => {
  const store = createSavedStore(() => ({
    getItem: () =>
      JSON.stringify({ saved: [], notes: {}, compare: [], design: "06" }),
    setItem() {},
    removeItem() {},
  }));
  assert.equal(store.state.design, "dark");
});
test("поиск нормализует регистр и ё, находит синонимы", () => {
  assert.equal(normalize(" ВЁРСТ "), "верст");
  assert(
    searchCatalog(data, { query: "7 ВЕРСТ" }).some((s) => s.id === "7-verst"),
  );
  assert(
    searchCatalog(data, { query: "стаканчики" }).some(
      (s) => s.id === "flexaprint",
    ),
  );
});
test("точный товар идет до частичного, затем название", () => {
  const stub = (id, name, products) => ({
    id,
    name,
    products,
    synonyms: [],
    city: "",
    category: "ingredients",
    delivery: [],
  });
  assert.deepEqual(
    searchCatalog(
      [
        stub("b", "Б", ["Крахмал картофельный"]),
        stub("a", "А", ["Крахмал"]),
        stub("c", "В", ["Крахмал"]),
      ],
      { query: "крахмал" },
    ).map((s) => s.id),
    ["a", "c", "b"],
  );
});
test("регион учитывает доставку, а не адрес офиса", () => {
  const result = searchCatalog(data, {
    region: "Свердловская область",
    category: "ingredients",
  });
  assert(result.length > 0);
  assert(!result.some((s) => s.id === "tehnopoliz"));
  assert(
    result.every((s) =>
      s.delivery.some((d) =>
        ["Россия", "Свердловская область"].includes(d.region),
      ),
    ),
  );
});
test("фильтры сочетаются, пустой поиск и сохраненное", () => {
  assert.equal(searchCatalog(data, { query: "несуществующийтовар" }).length, 0);
  assert.equal(searchCatalog(data, { category: "packaging" }).length, 19);
  assert.deepEqual(
    searchCatalog(data, { savedOnly: true, saved: ["flexaprint"] }).map(
      (s) => s.id,
    ),
    ["flexaprint"],
  );
});

for (const region of Object.keys(regionalIds))
  test(`реальные IDs и порядок доставки: ${region}`, () => {
    const found = searchCatalog(data, { region });
    assert.deepEqual(
      found.map((s) => s.id),
      expectedIds(region),
    );
    assert.deepEqual(
      found
        .filter((s) => deliveryMatch(s, region).scope === "regional")
        .map((s) => s.id),
      regionalIds[region],
    );
    assert(!found.some((s) => s.id === "tehnopoliz"));
  });
test("вся Россия и неизвестный регион сохраняют только подтвержденное покрытие", () => {
  assert.deepEqual(
    searchCatalog(data, { region: "Россия" }).map((s) => s.id),
    nationalIds,
  );
  assert.deepEqual(
    searchCatalog(data, { region: "Неизвестная область" }).map((s) => s.id),
    nationalIds,
  );
  assert(
    !searchCatalog(data, { region: "Россия" }).some(
      (s) => s.id === "zernov-nsk",
    ),
  );
});
test("город наследует область, городская доставка не расширяется на область", () => {
  const food = data.find((s) => s.id === "food-fiction"),
    korrex = data.find((s) => s.id === "korrex-td");
  assert.equal(deliveryMatch(food, "г. ЕКАТЕРИНБУРГ ").scope, "regional");
  assert.equal(deliveryMatch(korrex, "Свердловская область").scope, "none");
  assert.equal(
    deliveryMatch(
      data.find((s) => s.id === "tehnopoliz"),
      "Екатеринбург",
    ).scope,
    "none",
  );
});
test("география имеет приоритет перед федеральной группой при товаре и категории", () => {
  assert.deepEqual(
    searchCatalog(data, {
      region: "Екатеринбург",
      category: "packaging",
      query: "стакан",
    }).map((s) => s.id),
    ["korrex-td", "flexaprint"],
  );
  assert.equal(
    searchCatalog(data, {
      region: "Москва",
      category: "packaging",
      query: "молоко",
    }).length,
    0,
  );
});
test("отказ storage не ломает работу, состояние остается в памяти", () => {
  const store = createSavedStore(() => {
    throw Error("blocked");
  });
  assert.equal(store.available, false);
  store.save({ saved: ["a"], notes: { a: "заметка" }, compare: [] });
  assert.equal(store.state.notes.a, "заметка");
});
test("поврежденный storage и ошибка записи обрабатываются", () => {
  const store = createSavedStore(() => ({
    getItem: () => "{broken",
    setItem() {},
    removeItem() {},
  }));
  assert.equal(store.available, false);
  const fail = createSavedStore(() => ({
    getItem: () => null,
    setItem(k) {
      if (k === "suppliers:v1") throw Error("quota");
    },
    removeItem() {},
  }));
  fail.save({ saved: [], notes: {}, compare: [] });
  assert.equal(fail.available, false);
});

test("удаленные оформления возвращают таблицу, старые номера сохраняют вид", () => {
  for (const id of ["02", "04", "07"])
    assert.equal(normalizeDesign(id), "table");
  assert.equal(normalizeDesign("01"), "registry");
  assert.equal(normalizeDesign("03"), "table");
  assert.equal(normalizeDesign("10"), "search");
});
