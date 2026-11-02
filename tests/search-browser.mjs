import { chromium } from "playwright";
import assert from "node:assert/strict";
import { designs } from "../public/designs.js";
import { dismissTour } from "./browser-helpers.mjs";
const browser = await chromium.launch(),
  base = process.env.TEST_URL || "http://127.0.0.1:4173";
try {
  for (const [id] of designs)
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
          viewport: { width, height: 900 },
        }),
        page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${base}/?design=${id}`);
      await dismissTour(page);
      for (const [q, supplier, group] of [
        ["помидоры", "agropark-spb", "Овощи"],
        ["бананы", "agropark-spb", "Фрукты"],
        ["треска", "agropark-spb", "Рыба"],
        ["моцарелла", "sibirskiy-produkt-nsk", "Сыры"],
        ["куркума", "tk-dip", "Специи"],
        ["упаковка для тортов", "osq-group", "Кондитерская упаковка"],
      ]) {
        await page.locator("#query").fill(q);
        await page
          .locator("#search-form")
          .evaluate((form) => form.requestSubmit());
        const card = page.locator(`[data-supplier-id="${supplier}"]`);
        await card.waitFor();
        assert(
          (await card.locator(".search-reason").textContent())
            .toLocaleLowerCase("ru")
            .includes(group.toLocaleLowerCase("ru")),
        );
        assert(
          (await card.locator(".search-reason").textContent()).includes(
            "уточни",
          ),
        );
      }
      await page.locator(".compare-button").nth(0).click();
      await page.locator(".compare-button").nth(1).click();
      await page.locator("#compare-open").click();
      assert(await page.locator("#compare-dialog").evaluate((n) => n.open));
      await page.keyboard.press("Escape");
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      if (id === "table")
        await page.screenshot({
          path: `test-results/related-search-${width}.png`,
        });
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        `${id} ${width}: товарные группы, пояснения, сравнение и ширина - OK`,
      );
    }
} finally {
  await browser.close();
}
