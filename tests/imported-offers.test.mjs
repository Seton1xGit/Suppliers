import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {searchCatalog} from "../public/catalog-source.js";
import {selectedOffer,priceText,normalizedPrice} from "../public/offers.js";
import {validate} from "../scripts/validate.mjs";
const load=async n=>JSON.parse(await readFile(new URL(`../public/data/${n}.json`,import.meta.url),"utf8"));
const catalog=await load("catalog"),manual=await load("offers"),imported=await load("imported-offers"),offers=[...manual,...imported];
test("массовые предложения проходят общую схему без дублей и затирания ручных",()=>{
 validate(catalog,offers);assert.equal(new Set(offers.map(o=>o.id)).size,offers.length);
 assert.equal(manual.length,21);assert(imported.length>=459);
 for(const o of manual)assert(!imported.some(i=>i.supplierId===o.supplierId && i.name.toLocaleLowerCase('ru')===o.name.toLocaleLowerCase('ru')));
});
for(const [query,name,amount] of [["бананы","Бананы",190],["огурцы","Огурцы Бакинские",489],["курага","Курага отборная",1218]])test(`${query}: цена из массового прайса`,()=>{
 const selected=selectedOffer("food-star",offers,{query});assert.equal(selected.name,name);assert.equal(normalizedPrice(selected).min,amount);assert.equal(selected.market,"b2b");
 assert(searchCatalog(catalog,{query,offers,priceOnly:true}).some(s=>s.id==="food-star"));assert.equal(selected.sourceUrl,"https://www.food-star.ru/price/");
});
test("массовая позиция не выдается за посторонний товар или другую доставку",()=>{
 assert.equal(selectedOffer("food-star",offers,{query:"несуществующийтовар123"}),null);
 assert.equal(selectedOffer("food-star",offers,{query:"бананы",region:"Новосибирск"}),null);
 assert(!searchCatalog(catalog,{query:"бананы",region:"Новосибирск",offers,priceOnly:true}).some(s=>s.id==="food-star"));
});
