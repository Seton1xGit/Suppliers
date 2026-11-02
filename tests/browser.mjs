import { dismissTour } from "./browser-helpers.mjs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { expectedIds, regionalIds, nationalIds } from "./region-fixtures.mjs";
const browser = await chromium.launch({ headless: true }),
  base = process.env.TEST_URL || "http://127.0.0.1:4173";
await mkdir("test-results", { recursive: true });
try {
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector(".card");
    await dismissTour(page);
    assert.equal(await page.locator(".card").count(), 100);
    for (const region of ["Россия", ...Object.keys(regionalIds)]) {
      await page.locator("#region").selectOption(region);
      const ids = await page
        .locator(".card")
        .evaluateAll((nodes) => nodes.map((n) => n.dataset.supplierId));
      assert.deepEqual(ids, expectedIds(region), `${name}: ${region}`);
      assert(
        (await page.locator("#result-count").textContent()).startsWith(
          String(ids.length),
        ),
      );
      assert(
        (await page.locator("#view-caption").textContent()).includes(
          region === "Россия" ? "вся Россия" : region,
        ),
      );
      if (region !== "Россия")
        assert.deepEqual(
          await page
            .locator(".regional .card")
            .evaluateAll((nodes) => nodes.map((n) => n.dataset.supplierId)),
          regionalIds[region],
        );
    }
    await page.locator("#region").selectOption("Новосибирск");
    await page.reload();
    await page.waitForSelector(".card");
    await dismissTour(page);
    assert.equal(await page.locator("#region").inputValue(), "Новосибирск");
    await page.screenshot({ path: `test-results/${name}-filters-v2.png` });
    if (name === "mobile")
      await page
        .locator("#results")
        .evaluate((n) => n.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: `test-results/${name}-v2.png` });
    await page.locator("#reset").click();
    await page.locator("[data-category=packaging]").click();
    assert.equal(await page.locator(".card").count(), 19);
    await page.locator("#query").fill("стакан");
    assert((await page.locator(".card").count()) > 0);
    await page.locator("#region").selectOption("Екатеринбург");
    assert.deepEqual(
      await page
        .locator(".card")
        .evaluateAll((nodes) => nodes.map((n) => n.dataset.supplierId)),
      ["korrex-td", "flexaprint"],
    );
    await page.locator("#query").fill("zzzzнеизвестно");
    await page.waitForSelector(".empty");
    assert.equal(await page.locator(".card").count(), 0);
    await page.locator("#reset").click();
    assert.equal(await page.locator(".card").count(), 100);
    await page.locator("#query").fill("7 ВЕРСТ");
    assert.equal(await page.locator(".card").count(), 1);
    await page.locator("#reset").click();
    await page.locator(".save-button").first().click();
    await page.locator("#saved-nav").click();
    assert.equal(await page.locator(".card").count(), 1);
    await page.locator(".details-button").first().click();
    const note = page.locator("#detail-dialog textarea");
    await note.fill("Позвонить, запросить 20 кг <script>alert(1)</script>");
    await page.locator("#detail-dialog .close-dialog").click();
    await page.reload();
    await page.waitForSelector(".card");
    await dismissTour(page);
    assert.equal(await page.locator(".card").count(), 1);
    await page.locator(".details-button").first().click();
    assert(
      (await page.locator("#detail-dialog textarea").inputValue()).includes(
        "<script>",
      ),
    );
    assert.equal(await page.locator("#detail-dialog script").count(), 0);
    await page.locator("#detail-dialog .close-dialog").click();
    await page.locator("#reset").click();
    await page.locator(".compare-button").nth(0).click();
    assert(await page.locator("#compare-open").isDisabled());
    assert.equal(
      await page.evaluate(() => document.activeElement.className),
      "compare-button",
    );
    for (let i = 1; i < 4; i++)
      await page.locator(".compare-button").nth(i).click();
    const selection = await page.evaluate(
      () => JSON.parse(localStorage.getItem("suppliers:v1")).compare,
    );
    await page.locator("#region").selectOption("Новосибирск");
    assert.deepEqual(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("suppliers:v1")).compare,
      ),
      selection,
    );
    assert.equal(
      await page.locator("#compare-count").textContent(),
      "Выбрано: 4 из 4",
    );
    await page.locator("#region").selectOption("");
    await page.locator(".compare-button").nth(4).click();
    assert.equal(
      await page.locator(".compare-button[aria-pressed=true]").count(),
      4,
    );
    assert((await page.locator("#toast").textContent()).includes("до 4"));
    await page.locator("#compare-open").click();
    assert.equal(
      await page.locator("#compare-content .company-cell").count(),
      4,
    );
    await page.locator("#compare-content button:visible").first().click();
    assert.equal(
      await page.locator("#compare-content .company-cell").count(),
      3,
    );
    await page.screenshot({ path: `test-results/${name}-comparison-v2.png` });
    if (name === "mobile") {
      assert(await page.locator(".compare-grid").isVisible());
      assert(
        await page
          .locator("#compare-content")
          .evaluate((n) => n.scrollWidth > n.clientWidth),
      );
    }
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator("#compare-dialog").evaluate((d) => d.open),
      false,
    );
    await page.reload();
    await page.waitForSelector(".card");
    await dismissTour(page);
    assert((await page.locator("#compare-count").textContent()).includes("3"));
    page.once("dialog", (d) => d.accept());
    await page.locator("#clear-saved").click();
    assert.equal(await page.locator("#saved-count").textContent(), "0");
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("suppliers:v1")).notes &&
          Object.keys(JSON.parse(localStorage.getItem("suppliers:v1")).notes)
            .length,
      ),
      0,
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${name}: горизонтальный скролл`,
    );
    await page.locator("#query").focus();
    await page.keyboard.type("7 ВЕРСТ");
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(".card").count(), 1);
    await page.locator(".details-button").focus();
    await page.keyboard.press("Enter");
    assert(await page.locator("#detail-dialog").evaluate((n) => n.open));
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => document.activeElement.className),
      "details-button",
    );
    assert.deepEqual(errors, []);
    console.log(
      `${name}: поиск, фильтры, сброс, пустое состояние, сравнение, лимит, заметки, reload, очистка, XSS, ширина - OK`,
    );
    await context.close();
  }
  const unknownContext = await browser.newContext(),
    unknown = await unknownContext.newPage();
  await unknown.goto(
    base + "/?region=" + encodeURIComponent("Неизвестная область"),
  );
  await unknown.waitForSelector(".card");
  await dismissTour(unknown);
  assert.deepEqual(
    await unknown
      .locator(".card")
      .evaluateAll((nodes) => nodes.map((n) => n.dataset.supplierId)),
    nationalIds,
  );
  assert(await unknown.locator(".regional-empty").isVisible());
  await unknown.locator("#query").fill("неизвестныйтовар");
  assert.equal(await unknown.locator(".card").count(), 0);
  assert(await unknown.locator(".empty").isVisible());
  await unknownContext.close();
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
  await page.waitForSelector(".card");
  await dismissTour(page);
  assert(await page.locator("#storage-warning").isVisible());
  await page.locator(".save-button").first().click();
  assert.equal(await page.locator("#saved-count").textContent(), "1");
  await page.locator(".compare-button").first().click();
  await page.locator(".details-button").first().click();
  await page.locator("textarea").fill("Без storage");
  console.log("storage blocked: каталог, выбор, сравнение и заметка - OK");
  await context.close();
} finally {
  await browser.close();
}
