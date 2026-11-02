import { chromium } from "playwright";
import assert from "node:assert/strict";
import { designs } from "../public/designs.js";
const base = process.env.TEST_URL || "http://127.0.0.1:4173",
  browser = await chromium.launch();
try {
  for (const [id] of designs)
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      await context.addInitScript(() =>
        localStorage.setItem(
          "suppliers:v1",
          JSON.stringify({
            saved: [],
            notes: {},
            compare: ["geovita", "sibirskiy-produkt-nsk"],
            tourSeen: true,
          }),
        ),
      );
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${base}/?design=${id}&region=Новосибирск`);
      await page.waitForSelector("body[data-tour-ready=true]");
      await page.locator("#compare-open").click();
      const text = await page.locator("#compare-content").textContent();
      for (const label of [
        "Минимальная цена доставки",
        "Максимальная цена доставки",
        "Особенности поставщика",
        "Минимальный заказ",
        "Цена конкретного товара",
      ])
        assert(text.includes(label), label);
      assert(text.includes("305"));
      assert(text.includes("Не опубликовано"));
      assert(!text.includes("790 ₽"));
      await page.keyboard.press("Escape");
      await page.goto(
        `${base}/?design=${id}&q=${encodeURIComponent("Лихачевский")}`,
      );
      await page.waitForSelector("body[data-tour-ready=true]");
      await page.locator(".company-name-button").click();
      const detail = await page.locator("#detail-content").textContent();
      assert(detail.includes("99 ₽"));
      assert(detail.includes("упаковка 0,5 кг"));
      assert(detail.includes("Максимальная цена товара"));
      assert(detail.includes("Особенности поставщика"));
      assert(detail.includes("Самовывоз") || detail.includes("самовывоз"));
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        `${id} ${width}: цена, границы, единицы, регион, нюансы - OK`,
      );
    }
} finally {
  await browser.close();
}
