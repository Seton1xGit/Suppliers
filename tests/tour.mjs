import { chromium } from "playwright";
import assert from "node:assert/strict";
import { designs } from "../public/designs.js";
const base = process.env.TEST_URL || "http://127.0.0.1:4173",
  browser = await chromium.launch();
try {
  for (const [id] of designs)
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
        }),
        page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${base}/?design=${id}&region=Новосибирск`);
      await page.waitForSelector("body[data-tour-ready=true]");
      assert(await page.locator("#tour-dialog").evaluate((n) => n.open));
      assert(await page.locator("#tour-back").isDisabled());
      const before = await page
        .locator(".card")
        .evaluateAll((ns) => ns.map((n) => n.dataset.supplierId));
      await page.locator("#tour-next").click();
      assert.equal(await page.getAttribute("#tour-dialog", "data-step"), "2");
      await page.locator("#tour-back").click();
      assert.equal(await page.getAttribute("#tour-dialog", "data-step"), "1");
      for (let step = 1; step <= 4; step++) {
        assert.equal(
          await page.getAttribute("#tour-dialog", "data-step"),
          String(step),
        );
        const card = await page.locator(".tour-card").boundingBox();
        assert(
          card.x >= 0 &&
            card.y >= 0 &&
            card.x + card.width <= width &&
            card.y + card.height <= (width === 390 ? 844 : 1000) + 1,
          `${id} ${width} step ${step}`,
        );
        if (id === "table")
          await page.screenshot({
            path: `test-results/tour-${width}-${step}.png`,
          });
        await page.locator("#tour-next").click();
      }
      assert.equal(
        await page.locator("#tour-dialog").evaluate((n) => n.open),
        false,
      );
      assert.equal(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem("suppliers:v1")).tourSeen,
        ),
        true,
      );
      assert.deepEqual(
        await page
          .locator(".card")
          .evaluateAll((ns) => ns.map((n) => n.dataset.supplierId)),
        before,
      );
      await page.locator(".company-name-button").first().focus();
      await page.keyboard.press("Enter");
      assert(await page.locator("#detail-dialog").evaluate((n) => n.open));
      assert((await page.locator("#detail-title").textContent()).length > 0);
      await page.keyboard.press("Escape");
      await page.reload();
      await page.waitForSelector("body[data-tour-ready=true]");
      assert.equal(
        await page.locator("#tour-dialog").evaluate((n) => n.open),
        false,
      );
      await page.locator("#tour-help").click();
      assert.equal(await page.getAttribute("#tour-dialog", "data-step"), "1");
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator("#tour-dialog").evaluate((n) => n.open),
        false,
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        `${id} ${width}: 4 шага, назад, завершение, первый визит, повтор, Escape, название компании - OK`,
      );
    }
  const context = await browser.newContext();
  await context.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw Error("blocked");
      },
    }),
  );
  const page = await context.newPage();
  await page.goto(base);
  await page.waitForSelector("body[data-tour-ready=true]");
  assert(await page.locator("#tour-dialog").evaluate((n) => n.open));
  await page.locator("#tour-skip").click();
  await page.locator("#tour-help").click();
  await page.locator("#tour-close").click();
  assert(await page.locator("#storage-warning").isVisible());
  assert.equal(
    await page.locator("#tour-dialog").evaluate((n) => n.open),
    false,
  );
  await context.close();
  console.log(
    "Storage blocked: пропустить, повторить, закрыть и продолжить работу - OK",
  );
} finally {
  await browser.close();
}
