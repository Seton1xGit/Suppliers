import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  searchCatalog,
  productMatch,
  deliveryMatch,
} from "../public/catalog-source.js";
const data = JSON.parse(
  await readFile(
    new URL("../public/data/catalog.json", import.meta.url),
    "utf8",
  ),
);
const queries = [
  ["помидоры", "agropark-spb", "Овощи"],
  ["томаты", "dikiy-sbor", "Овощи"],
  ["бананы", "agropark-spb", "Фрукты"],
  ["треска", "agropark-spb", "Рыба"],
  ["креветки", "agropark-spb", "Морепродукты"],
  ["говядина", "agropark-spb", "Мясо и птица"],
  ["кефир", "sibirskiy-produkt-nsk", "Молочная продукция"],
  ["моцарелла", "sibirskiy-produkt-nsk", "Сыры"],
  ["спагетти", "agropark-spb", "Бакалея"],
  ["гречка", "tk-dip", "Крупы"],
  ["куркума", "tk-dip", "Специи и приправы"],
  ["кетчуп", "agropark-spb", "Соусы"],
  ["клубника", "dikiy-sbor", "Ягоды"],
  ["белые грибы", "dikiy-sbor", "Грибы"],
  ["фундук", "ingerman", "Орехи"],
  ["оливковое масло", "tk-dip", "Растительные масла"],
  ["ржаная мука", "tk-dip", "Мука"],
  ["кукурузный крахмал", "grandresurs", "Крахмал"],
  ["печенье", "megaopt-nsk", "Кондитерские изделия"],
  ["чиабатта", "karavay-spb", "Хлебобулочные изделия"],
  ["тефтели", "food-factory-spb", "Мясные полуфабрикаты"],
  ["сардельки", "sibkolbasy", "Колбасная продукция"],
  ["яйца", "megaopt-nsk", "Яичная продукция"],
  ["кармин", "soyuzopttorg", "Пищевые красители"],
  ["ванилин", "soyuzopttorg", "Ароматизаторы"],
  ["сукралоза", "tehnopoliz", "Подсластители"],
  ["стаканы для кофе", "flexaprint", "Бумажные стаканы"],
  ["вакуумные пакеты", "clever54", "Пакеты"],
  ["пищевые контейнеры", "technoproekt", "Контейнеры"],
  ["стрейч-пленка", "clever54", "Пленка"],
  ["молочный шоколад", "ingerman", "Шоколад"],
  ["вишневая начинка", "dinas-msk", "Начинки"],
  ["смесь для кексов", "leimu", "Смеси для выпечки"],
  ["смесь для багетов", "aroma-lux", "Хлебопекарные смеси"],
  ["яблочный сок", "sady-pridonya", "Фруктовые соки"],
  ["томатный сок", "sady-pridonya", "Овощные соки"],
  ["борщ", "food-fiction", "Супы"],
  ["оливье", "eattery", "Салаты"],
  ["упаковка для тортов", "osq-group", "Кондитерская упаковка"],
  ["коробки для пиццы", "clever54", "Картонная упаковка"],
];
for (const [query, id, group] of queries)
  test(`${query}: общий ассортимент ${id}`, () => {
    const s = data.find((s) => s.id === id),
      match = productMatch(s, query);
    assert(match.matches);
    if (match.related) assert.equal(match.related.group, group);
    assert(searchCatalog(data, { query }).some((s) => s.id === id));
  });
test("товар и производные не подменяют друг друга", () => {
  for (const [id, q] of [
    ["sady-pridonya", "бананы"],
    ["ekor", "треска"],
    ["flytexspb", "помидоры"],
    ["agropark-spb", "лимонная кислота"],
    ["agropark-spb", "рыбий жир"],
    ["agropark-spb", "молочный шоколад"],
    ["sp-tara", "вакуумные пакеты"],
  ])
    assert.equal(
      productMatch(
        data.find((s) => s.id === id),
        q,
      ).matches,
      false,
      `${id} ${q}`,
    );
});
test("общая группа находит конкретный ассортимент", () => {
  assert(searchCatalog(data, { query: "рыба" }).some((s) => s.id === "ekor"));
  assert(
    searchCatalog(data, { query: "орехи" }).some((s) => s.id === "dikiy-sbor"),
  );
});
test("прямое совпадение выше общего, фильтры сохраняются", () => {
  const stub = (id, products) => ({
    id,
    name: id,
    products,
    synonyms: [],
    city: "",
    category: "ingredients",
    delivery: [],
  });
  const items = [
    stub("group", ["Овощи"]),
    stub("exact", ["Помидоры"]),
    stub("other", ["Огурцы"]),
  ];
  assert.deepEqual(
    searchCatalog(items, { query: "помидоры" }).map((s) => s.id),
    ["exact", "group"],
  );
  assert.deepEqual(
    searchCatalog(data, { query: "треска", category: "packaging" }),
    [],
  );
  assert.deepEqual(
    searchCatalog(data, { query: "треска", savedOnly: true, saved: [] }),
    [],
  );
  assert(
    searchCatalog(data, { query: "треска", region: "неизвестный город" }).every(
      (s) => deliveryMatch(s, "неизвестный город").scope === "national",
    ),
  );
});
test("каждая исходная товарная позиция всех 75 компаний остается доступна", () => {
  for (const supplier of data)
    for (const query of supplier.products)
      assert(
        searchCatalog(data, { query }).some((s) => s.id === supplier.id),
        `${supplier.id}: ${query}`,
      );
});

test("тип сока не подменяется другим", () => {
  const supplier = {
    name: "Сок",
    products: ["Фруктовые соки"],
    synonyms: [],
    city: "",
  };
  assert.equal(productMatch(supplier, "томатный сок").matches, false);
  assert.equal(productMatch(supplier, "яблочный сок").matches, true);
});
