import { chromium } from "playwright";
import assert from "node:assert/strict";
import { designs } from "../public/designs.js";
const base = process.env.TEST_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch();
try {
  for (const [design] of designs)
    for (const width of [1440, 390]) {
      const c = await browser.newContext({
        viewport: { width, height: 1000 },
        hasTouch: width === 390,
      });
      await c.addInitScript(() => {
        if (!localStorage.getItem("suppliers:v1"))
          localStorage.setItem(
            "suppliers:v1",
            JSON.stringify({
              saved: ["likhachevsky"],
              notes: { likhachevsky: "Спросить прайс" },
              compare: [],
              tourSeen: true,
            }),
          );
      });
      const p = await c.newPage(),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(
        `${base}/?design=${design}&q=${encodeURIComponent("помидоры")}&product=regular`,
      );
      await p.waitForSelector("body[data-tour-ready=true]");
      await p.locator("#price-only").check();
      assert.equal(await p.locator(".card").count(), 5);
      assert.equal(
        await p.locator(".card").first().getAttribute("data-supplier-id"),
        "sofiiskaya-baza",
      );
      const choice = p.locator("[data-offer-choice=kalinbaza]");
      await choice.selectOption("kalinbaza-red-box");
      assert(p.url().includes("kalinbaza-red-box"));
      await p.reload();
      await p.waitForSelector("body[data-tour-ready=true]");
      assert.equal(
        await p.locator("[data-offer-choice=kalinbaza]").inputValue(),
        "kalinbaza-red-box",
      );
      assert(
        (
          await p
            .locator("[data-supplier-id=kalinbaza] .offer-original")
            .textContent()
        )
          .replaceAll("\u00a0", " ")
          .includes("2 093"),
      );
      assert(
        (await p.locator(".card .price-amount").first().textContent()).includes(
          "242",
        ),
      );
      const block = p.locator(".card .offer-block").first();
      assert(await block.locator(".price-source").getAttribute("href"));
      assert((await block.textContent()).includes("02.11.2026"));
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${design} ${width} viewport`,
      );
      await p.locator(".compare-button").nth(0).click();
      await p.locator(".compare-button").nth(1).click();
      await p.locator("#compare-open").click();
      const comparison = p.locator("#compare-content");
      assert.equal(await comparison.locator(".offer-block").count(), 2);
      const prices = await comparison
        .locator(".offer-block .price-amount")
        .allTextContents();
      assert(
        prices.some((t) => t.includes("242")) &&
          prices.some((t) => t.includes("299")),
      );
      assert(!prices.some((t) => /^(от )?99 ₽/.test(t)));
      assert(
        (
          await comparison.locator(".offer-block").first().textContent()
        ).includes("Томаты свежие красные"),
      );
      await p.locator("#compare-dialog .close-dialog").click();
      await p.locator("#price-sort").selectOption("desc");
      assert.equal(
        await p.locator(".card").first().getAttribute("data-supplier-id"),
        "food-star",
      );
      const next = design === "dark" ? "table" : "dark";
      await p.locator("#design-picker summary").click();
      await p.locator(`[data-design-choice=${next}]`).click();
      assert.equal(await p.locator("#price-sort").inputValue(), "desc");
      assert(await p.locator("#price-only").isChecked());
      assert.equal(await p.locator("#offer-group").inputValue(), "regular");
      await p.reload();
      await p.waitForSelector("body[data-tour-ready=true]");
      assert.equal(
        await p.locator(".card").first().getAttribute("data-supplier-id"),
        "food-star",
      );
      const state = await p.evaluate(() =>
        JSON.parse(localStorage.getItem("suppliers:v1")),
      );
      assert.equal(state.compare.length, 2);
      assert(state.saved.includes("likhachevsky"));
      assert.equal(state.notes.likhachevsky, "Спросить прайс");
      await p.locator("#region").selectOption("Новосибирск");
      assert.equal(await p.locator(".card").count(), 0);
      await p.locator("#compare-open").click();
      assert(
        (
          await p
            .locator("#compare-content .offer-block .price-amount")
            .allTextContents()
        ).every((t) => t === "Цена по запросу"),
      );
      await p.locator("#compare-dialog .close-dialog").click();
      await p.locator("#query").fill("несуществующийтовар123");
      assert.equal(await p.locator(".card").count(), 0);
      await p.locator("#compare-open").click();
      assert(
        !(await p.locator("#compare-content .offer-block").allTextContents())
          .join(" ")
          .includes("Томаты"),
      );
      await p.locator("#compare-dialog .close-dialog").click();
      assert.deepEqual(errors, []);
      await c.close();
      console.log(
        `${design} ${width}: query prices, source, comparison, sort, filters, design, reload, unrelated query - OK`,
      );
    }
} finally {
  await browser.close();
}
