import { chromium } from "playwright";
import assert from "node:assert/strict";
import { designs } from "../public/designs.js";
import { dismissTour } from "./browser-helpers.mjs";
const browser = await chromium.launch();
const base = process.env.TEST_URL || "http://127.0.0.1:4173";
try {
  for (const [design] of designs)
    for (const width of [320, 360, 390, 430, 700, 844]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 844 ? 390 : 844 },
        hasTouch: true,
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${base}/?design=${design}`);
      await dismissTour(page);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${design} ${width}: page overflow`,
      );
      const card = page.locator(".card").first();
      const rect = await card.boundingBox();
      assert(rect.x >= 0 && rect.x + rect.width <= width + 1);
      for (const selector of [
        "#query",
        "#region",
        "#tour-help",
        ".details-button",
        ".compare-button",
        ".save-button",
      ]) {
        const control = page.locator(selector).first();
        const box = await control.boundingBox();
        assert(
          box.height >= 44,
          `${design} ${width}: ${selector} target ${box.height}`,
        );
      }
      assert(
        await page
          .locator("#query")
          .evaluate((n) => parseFloat(getComputedStyle(n).fontSize) >= 16),
      );
      await page.locator(".compare-button").nth(0).tap();
      await page.locator(".compare-button").nth(1).tap();
      await page.locator("#compare-open").tap();
      assert(await page.locator(".compare-grid").isVisible());
      assert.equal(await page.locator(".company-cell").count(), 2);
      const frame = page.locator("#compare-content");
      assert(await frame.evaluate((n) => n.scrollWidth <= n.clientWidth + 1));
      const header = page.locator(".company-cell").first();
      const before = await header.boundingBox();
      await frame.evaluate((n) => (n.scrollTop = 250));
      const after = await header.boundingBox();
      assert(Math.abs(before.y - after.y) < 2, "sticky company header");
      await frame.evaluate((n) => (n.scrollTop = 0));
      await page.locator(".company-cell button").first().tap();
      assert.equal(await page.locator(".company-cell").count(), 1);
      await page.locator("#compare-dialog .close-dialog").tap();
      await page.locator(".company-name-button").first().tap();
      assert(
        await page
          .locator("#detail-dialog")
          .evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
      );
      await page.touchscreen.tap(3, 3);
      assert.equal(
        await page.locator("#detail-dialog").evaluate((n) => n.open),
        false,
      );
      assert.deepEqual(errors, []);
      if (width === 390) {
        await page.locator("#query").blur();
        await page.screenshot({ path: `test-results/mobile-${design}.png` });
      }
      await context.close();
      console.log(
        `${design} ${width}: mobile cards, targets, comparison, detail - OK`,
      );
    }
} finally {
  await browser.close();
}
