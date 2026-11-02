import { dismissTour } from "./browser-helpers.mjs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { designs, designNumber } from "../public/designs.js";
import { expectedIds } from "./region-fixtures.mjs";
const base = process.env.TEST_URL || "http://127.0.0.1:4173",
  out = "test-results/app-designs";
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const ids = (page) =>
  page
    .locator("#cards .card")
    .evaluateAll((ns) => ns.map((n) => n.dataset.supplierId));
const ready = async (page) => {
  await page.waitForSelector("body[data-ready=true]");
  await dismissTour(page);
};
const row = (page, id) => page.locator(`#cards [data-supplier-id="${id}"]`);
async function choose(page, id) {
  if (!(await page.locator("#design-picker").evaluate((n) => n.open)))
    await page.locator("#design-picker summary").click();
  await page.locator(`[data-design-choice="${id}"]`).click();
  assert.equal(await page.getAttribute("body", "data-design"), id);
}
async function note(page, id, value) {
  await row(page, id).locator(".details-button").click();
  const area = page.locator("#detail-dialog textarea");
  if (value !== undefined) await area.fill(value);
  const actual = await area.inputValue();
  assert.equal(await page.locator("#detail-dialog script").count(), 0);
  await page.keyboard.press("Escape");
  return actual;
}
try {
  const initial = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    first = await initial.newPage();
  await first.goto(base);
  await ready(first);
  assert.equal(await first.getAttribute("body", "data-design"), "table");
  assert.equal(await first.locator(".procurement-table").count(), 1);
  await first.screenshot({ path: `${out}/default-03.png` });
  await first.locator("#design-picker summary").click();
  assert.equal(await first.locator("[data-design-choice]").count(), 7);
  await first.screenshot({ path: `${out}/switcher.png` });
  await first.keyboard.press("Escape");
  await initial.close();
  for (const [id] of designs) {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `${base}/?design=${id}&region=${encodeURIComponent("Новосибирск")}`,
    );
    await ready(page);
    assert.deepEqual(await ids(page), expectedIds("Новосибирск"));
    await page.screenshot({ path: `${out}/${id}-desktop.png` });
    if (process.env.CAPTURE_GALLERY)
      await page.screenshot({
        path: `public/previews/designs/shots/${designNumber(id)}.png`,
      });
    await page.locator("#region").selectOption("Екатеринбург");
    assert.deepEqual(await ids(page), expectedIds("Екатеринбург"));
    await page.locator("#query").fill("стакан");
    await page.locator("[data-category=packaging]").click();
    assert.deepEqual(await ids(page), ["korrex-td", "flexaprint"]);
    const text = "Запросить 1000 стаканов <script>alert(1)</script>";
    assert.equal(await note(page, "korrex-td", text), text);
    await row(page, "korrex-td").locator(".save-button").click();
    await page.locator("#saved-nav").click();
    assert.deepEqual(await ids(page), ["korrex-td"]);
    await row(page, "korrex-td").locator(".compare-button").click();
    await page.locator("#catalog-nav").click();
    await row(page, "flexaprint").locator(".compare-button").click();
    await page.locator("#compare-open").click();
    assert.equal(
      await page.locator("#compare-content .company-cell").count(),
      2,
    );
    assert(
      (await page.locator("#compare-content").textContent()).includes(text),
    );
    assert.equal(await page.locator("#compare-content script").count(), 0);
    await page.keyboard.press("Escape");
    await page.locator("#query").fill("неттакоготовара");
    assert.equal(await page.locator(".card").count(), 0);
    assert(await page.locator(".empty").isVisible());
    await page.locator("#reset").click();
    for (let i = 0; i < 2; i++)
      await page
        .locator("#cards .compare-button[aria-pressed=false]")
        .first()
        .click();
    await page
      .locator("#cards .compare-button[aria-pressed=false]")
      .first()
      .click();
    assert.equal(
      await page.locator(".compare-button[aria-pressed=true]").count(),
      4,
    );
    assert((await page.locator("#toast").textContent()).includes("до 4"));
    await page.reload();
    await ready(page);
    assert.equal(await page.getAttribute("body", "data-design"), id);
    assert.equal(
      await page.locator(".compare-button[aria-pressed=true]").count(),
      4,
    );
    assert.equal(await note(page, "korrex-td"), text);
    assert.equal(await page.locator("#saved-count").textContent(), "1");
    await page.locator("#compare-open").click();
    await page.locator("#compare-content .company-cell button").first().click();
    assert.equal(
      await page.locator("#compare-content .company-cell").count(),
      3,
    );
    await page.keyboard.press("Escape");
    await page.locator("#compare-clear").click();
    page.once("dialog", (d) => d.accept());
    await page.locator("#clear-saved").click();
    assert.equal(await page.locator("#saved-count").textContent(), "0");
    assert.equal(
      await page.evaluate(
        () =>
          Object.keys(JSON.parse(localStorage.getItem("suppliers:v1")).notes)
            .length,
      ),
      0,
    );
    assert.equal(await page.getAttribute("body", "data-design"), id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#region").selectOption("Новосибирск");
    await page.reload();
    await ready(page);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${out}/${id}-mobile.png` });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow ${id}`,
    );
    await page.locator("#design-picker summary").click();
    const pickerBox = await page.locator(".design-panel").boundingBox();
    assert(
      pickerBox.x >= 0 && pickerBox.x + pickerBox.width <= 390,
      `picker ${id}`,
    );
    if (id === "table")
      await page.screenshot({ path: `${out}/switcher-mobile.png` });
    await page.locator("#design-picker summary").click();
    if (id === "table") {
      const action = await page
        .locator(".card .details-button")
        .first()
        .boundingBox();
      assert(action.x + action.width <= 390);
      assert(
        await page
          .locator(".procurement-table")
          .first()
          .evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
      );
    }
    await page.locator(".details-button").first().focus();
    await page.keyboard.press("Enter");
    assert(await page.locator("#detail-dialog").evaluate((n) => n.open));
    await page.keyboard.press("Escape");
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `${id}: все действия, источники, заметки, XSS, лимит, refresh, очистка, mobile, клавиатура - OK`,
    );
  }
  const context = await browser.newContext(),
    page = await context.newPage();
  await page.goto(
    `${base}/?q=стакан&category=packaging&region=${encodeURIComponent("Екатеринбург")}`,
  );
  await ready(page);
  await row(page, "korrex-td").locator(".save-button").click();
  await row(page, "korrex-td").locator(".compare-button").click();
  await row(page, "flexaprint").locator(".compare-button").click();
  const text = "Общая заметка между оформлениями";
  await note(page, "korrex-td", text);
  for (const [id] of [...designs.filter(([id]) => id !== "table"), ["table"]]) {
    await choose(page, id);
    assert.equal(await page.locator("#query").inputValue(), "стакан");
    assert.equal(await page.locator("#region").inputValue(), "Екатеринбург");
    assert.equal(
      await page
        .locator("[data-category=packaging]")
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.deepEqual(await ids(page), ["korrex-td", "flexaprint"]);
    assert.equal(await page.locator("#saved-count").textContent(), "1");
    assert.equal(
      await page.locator("#compare-count").textContent(),
      "Выбрано: 2 из 4",
    );
    assert.equal(await note(page, "korrex-td"), text);
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("suppliers:v1")),
    );
    assert.deepEqual(stored.compare, ["korrex-td", "flexaprint"]);
    assert.deepEqual(stored.saved, ["korrex-td"]);
    assert.equal(stored.notes["korrex-td"], text);
    assert(!new URL(page.url()).searchParams.has("notes"));
    assert(!new URL(page.url()).searchParams.has("saved"));
  }
  await choose(page, "workspace");
  await page.reload();
  await ready(page);
  assert.equal(await page.getAttribute("body", "data-design"), "workspace");
  assert.equal(await page.locator("#query").inputValue(), "стакан");
  await page.goto(base);
  await ready(page);
  assert.equal(await page.getAttribute("body", "data-design"), "workspace");
  await page.goto(`${base}/?design=registry`);
  await ready(page);
  assert.equal(await page.getAttribute("body", "data-design"), "registry");
  await page.goto(`${base}/?design=unknown`);
  await ready(page);
  assert.equal(await page.getAttribute("body", "data-design"), "table");
  await page.locator("#design-picker summary").focus();
  await page.keyboard.press("Enter");
  await page.locator('[data-design-choice="dark"]').focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.getAttribute("body", "data-design"), "dark");
  await page.locator("#design-picker summary").click();
  await page.locator("#main-design").click();
  assert.equal(await page.getAttribute("body", "data-design"), "table");
  await context.close();
  console.log(
    "Все переходы: query/category/region/IDs/saved/notes сохранены; URL, fallback, основной 01 и восстановление - OK",
  );
  const blocked = await browser.newContext();
  await blocked.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw Error("blocked");
      },
    }),
  );
  const memory = await blocked.newPage();
  await memory.goto(
    `${base}/?region=${encodeURIComponent("Екатеринбург")}&category=packaging&q=стакан`,
  );
  await ready(memory);
  assert(await memory.locator("#storage-warning").isVisible());
  await row(memory, "korrex-td").locator(".save-button").click();
  await row(memory, "korrex-td").locator(".compare-button").click();
  await note(memory, "korrex-td", "В памяти");
  for (const [id] of designs) {
    await choose(memory, id);
    assert.deepEqual(await ids(memory), ["korrex-td", "flexaprint"]);
    assert.equal(await memory.locator("#saved-count").textContent(), "1");
    assert.equal(
      await memory.locator("#compare-count").textContent(),
      "Выбрано: 1 из 4",
    );
    assert.equal(await note(memory, "korrex-td"), "В памяти");
    assert(await memory.locator("#storage-warning").isVisible());
  }
  await blocked.close();
  console.log(
    "Storage blocked: все 7 оформлений с общим выбором и заметкой в памяти - OK",
  );
  const quota = await browser.newContext();
  await quota.addInitScript(() => {
    let deny = false;
    window.blockWrites = () => (deny = true);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (deny) throw new DOMException("Quota", "QuotaExceededError");
      return original.call(this, k, v);
    };
  });
  const qp = await quota.newPage();
  await qp.goto(base);
  await ready(qp);
  await qp.evaluate(() => window.blockWrites());
  await qp.locator(".save-button").first().click();
  assert(await qp.locator("#storage-warning").isVisible());
  await choose(qp, "dark");
  assert.equal(await qp.locator("#saved-count").textContent(), "1");
  await quota.close();
  const gal = await browser.newContext({
      viewport: { width: 2400, height: 1400 },
    }),
    gp = await gal.newPage();
  await gp.goto(base + "/previews/designs/");
  await gp.waitForSelector("body[data-ready=true]");
  assert.equal(await gp.locator(".concept-card").count(), 7);
  for (const [id] of designs) {
    await gp.goto(base + `/previews/designs/${designNumber(id)}.html`);
    await ready(gp);
    assert.equal(await gp.getAttribute("body", "data-design"), id);
    assert.equal(await gp.locator("#region").inputValue(), "Новосибирск");
  }
  for (const [name, query] of [
    ["contact-sheet", "?sheet=1"],
    ["contact-sheet-01-05", "?sheet=1&part=1"],
    ["contact-sheet-06-10", "?sheet=1&part=2"],
  ]) {
    await gp.goto(base + "/previews/designs/" + query);
    await gp.waitForSelector("body[data-ready=true]");
    await gp.evaluate(() =>
      Promise.all([...document.images].map((img) => img.decode())),
    );
    await gp.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  }
  await gal.close();
  console.log(
    "Галерея: 7 ссылок ведут в полноценный сервис, листы обновлены - OK",
  );
} finally {
  await browser.close();
}
