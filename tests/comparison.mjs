import { chromium } from "playwright";
import assert from "node:assert/strict";
import { designs } from "../public/designs.js";
const base = process.env.TEST_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch();
try {
  for (const [design] of designs)
    for (const width of [320, 390, 844, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 844 ? 390 : 900 },
        hasTouch: width < 1000,
      });
      await context.addInitScript(() =>
        localStorage.setItem(
          "suppliers:v1",
          JSON.stringify({
            saved: [],
            notes: {},
            compare: ["geovita", "rm-pack", "cake-me", "likhachevsky"],
            tourSeen: true,
          }),
        ),
      );
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${base}/?design=${design}`);
      await page.waitForSelector("body[data-tour-ready=true]");
      await page.locator("#compare-open").click();
      const frame = page.locator("#compare-content");
      assert(await frame.isVisible());
      assert.equal(await frame.locator(".company-cell").count(), 4);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      const field = frame.locator(".field-name").first(),
        header = frame.locator(".company-cell").first();
      const fieldX = (await field.boundingBox()).x,
        headerY = (await header.boundingBox()).y;
      await frame.evaluate((n) => (n.scrollTop = 300));
      assert(Math.abs((await header.boundingBox()).y - headerY) < 2);
      if (width < 700) {
        assert(await frame.evaluate((n) => n.scrollWidth > n.clientWidth));
        await page.locator("#compare-columns button").last().click();
        await page.waitForFunction(() => {
          const n = document.getElementById("compare-content");
          return n.scrollLeft >= n.scrollWidth - n.clientWidth - 2;
        });
        assert(Math.abs((await field.boundingBox()).x - fieldX) < 2);
        const last = await frame.locator(".company-cell").last().boundingBox(),
          viewport = await frame.boundingBox();
        assert(last.x + last.width <= viewport.x + viewport.width + 2);
      }
      await frame.evaluate((n) => n.scrollTo({ left: 0, top: 0 }));
      const equal = frame.locator(".compare-row[data-equal=true]");
      assert((await equal.count()) > 0);
      await page.locator("#compare-differences").check();
      assert.equal(
        await frame.locator(".compare-row[data-equal=true]:visible").count(),
        0,
      );
      assert.equal(await frame.locator(".company-cell:visible").count(), 4);
      await page.locator("#compare-differences").uncheck();
      assert(await equal.first().isVisible());
      const minimum = frame
        .locator(".compare-row")
        .filter({
          has: page.locator(".compare-label-full", {
            hasText: "Минимальный заказ",
          }),
        })
        .first();
      await minimum.locator("summary").first().click();
      assert(
        (await minimum.locator("details").first().textContent()).includes(
          "2000",
        ),
      );
      await frame.evaluate((n) => (n.scrollTop = 0));
      await frame.locator(".company-cell button").first().click();
      assert.equal(await frame.locator(".company-cell").count(), 3);
      assert.equal(await page.locator("#compare-columns button").count(), 3);
      if (design === "table") {
        await page.screenshot({
          path: `test-results/comparison-table-${width}.png`,
        });
      }
      await page.locator("#compare-dialog .close-dialog").click();
      assert.equal(
        await page.locator("#compare-dialog").evaluate((n) => n.open),
        false,
      );
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        `${design} ${width}: table, sticky axes, column navigation, differences, conditions, remove - OK`,
      );
    }
} finally {
  await browser.close();
}
