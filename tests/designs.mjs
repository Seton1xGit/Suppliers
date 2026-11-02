import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
const base = process.env.TEST_URL || "http://127.0.0.1:4173",
  path = "/previews/designs/";
const output = "test-results/designs";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    }),
    page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (let i = 1; i <= 10; i++) {
    const number = String(i).padStart(2, "0");
    const response = await page.goto(base + path + number + ".html");
    assert.equal(response.status(), 200);
    await page.waitForSelector("body[data-ready=true]");
    assert.equal(await page.locator("[data-results] .supplier").count(), 14);
    assert.equal(
      await page.locator("[data-region]").inputValue(),
      "Новосибирск",
    );
    await page.screenshot({ path: `${output}/${number}-desktop.png` });
    if (!process.env.TEST_URL)
      await page.screenshot({
        path: `public/previews/designs/shots/${number}.png`,
      });
    await page.locator("[data-region]").selectOption("Екатеринбург");
    assert.equal(await page.locator("[data-results] .supplier").count(), 15);
    assert.equal(
      await page
        .locator("[data-results] .supplier")
        .first()
        .getAttribute("data-supplier-id"),
      "packtochka",
    );
    await page.locator("[data-region]").selectOption("Новосибирск");
    await page.locator("[data-query]").fill("грибы");
    await page.locator("[data-category=ingredients]").click();
    assert.equal(await page.locator("[data-results] .supplier").count(), 1);
    await page.locator("[data-query]").fill("неизвестныйтовар");
    assert(await page.locator(".empty").isVisible());
    await page.locator("[data-query]").fill("");
    await page.locator('[data-category=""]').click();
    await page.locator("[data-results] .compare-action").nth(0).click();
    await page.locator("[data-results] .compare-action").nth(1).click();
    await page.locator("[data-open-compare]").first().click();
    assert(await page.locator("#comparison").evaluate((n) => n.open));
    assert.equal(await page.locator(".comparison-company").count(), 2);
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${output}/${number}-mobile.png` });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Горизонтальный скролл ${number}`,
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log(
      `${number}: desktop, mobile, фильтр доставки, поиск, источник, сравнение - OK`,
    );
  }
  await page.goto(base + path);
  await page.waitForSelector("body[data-ready=true]");
  assert.equal(await page.locator(".concept-card").count(), 10);
  await page.locator("#view-toggle").click();
  assert(
    await page
      .locator("#gallery")
      .evaluate((n) => n.classList.contains("large")),
  );
  await page.locator("#view-toggle").click();
  for (const href of await page
    .locator(".open-link")
    .evaluateAll((ns) => ns.map((n) => n.href))) {
    const response = await page.request.get(href);
    assert.equal(response.status(), 200);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: `${output}/gallery-mobile.png` });
  await page.setViewportSize({ width: 2400, height: 1400 });
  for (const [name, query] of [
    ["contact-sheet", "?sheet=1"],
    ["contact-sheet-01-05", "?sheet=1&part=1"],
    ["contact-sheet-06-10", "?sheet=1&part=2"],
  ]) {
    await page.goto(base + path + query);
    await page.waitForSelector("body[data-ready=true]");
    await page.evaluate(() =>
      Promise.all([...document.images].map((img) => img.decode())),
    );
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log(
    "Галерея: ровно 10, все ссылки, крупный просмотр, mobile и контактные листы - OK",
  );
  await context.close();
} finally {
  await browser.close();
}
