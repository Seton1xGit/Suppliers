export async function dismissTour(page) {
  await page.waitForSelector("body[data-tour-ready=true]");
  if (await page.locator("#tour-dialog").evaluate((n) => n.open))
    await page.locator("#tour-skip").click();
}
