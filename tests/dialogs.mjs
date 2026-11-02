import { chromium } from "playwright";
import assert from "node:assert/strict";
import { designs } from "../public/designs.js";
import { dismissTour } from "./browser-helpers.mjs";
const browser = await chromium.launch();
const base = process.env.TEST_URL || "http://127.0.0.1:4173";
try {
  for (const [id] of designs)
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: width === 390,
      });
      const page = await context.newPage();
      await page.goto(`${base}/?design=${id}`);
      await dismissTour(page);
      const dialog = page.locator("#detail-dialog");
      const open = async () =>
        page.locator(".company-name-button").first().click();
      const isOpen = () => dialog.evaluate((n) => n.open);
      await open();
      await page.locator("#detail-title").click();
      assert(await isOpen());
      const r = await dialog.boundingBox();
      await page.mouse.click(r.x + 8, r.y + 8);
      assert(await isOpen());
      await page.mouse.move(r.x + 20, r.y + 20);
      await page.mouse.down();
      await page.mouse.move(3, 3);
      await page.mouse.up();
      assert(await isOpen());
      if (width === 390) await page.touchscreen.tap(3, 3);
      else await page.mouse.click(3, 3);
      assert.equal(await isOpen(), false);
      await open();
      await page.keyboard.press("Escape");
      assert.equal(await isOpen(), false);
      await open();
      await dialog.locator(".close-dialog").click();
      assert.equal(await isOpen(), false);
      await page.locator(".compare-button").nth(0).click();
      await page.locator(".compare-button").nth(1).click();
      await page.locator("#compare-open").click();
      await page.mouse.click(3, 3);
      assert.equal(
        await page.locator("#compare-dialog").evaluate((n) => n.open),
        false,
      );
      assert.equal(
        await page.locator("#compare-count").textContent(),
        "Выбрано: 2 из 4",
      );
      await context.close();
      console.log(
        `${id} ${width}: фон закрывает, внутри и перетаскивание сохраняют окно, Escape и крестик работают`,
      );
    }
} finally {
  await browser.close();
}
