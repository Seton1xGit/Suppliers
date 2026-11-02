import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true}), base=process.env.TEST_URL||'http://127.0.0.1:4173';
await mkdir('test-results',{recursive:true});
try {
for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]) {
  const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForSelector('.card');
  assert.equal(await page.locator('.card').count(),30);
  await page.locator('[data-category=packaging]').click();assert.equal(await page.locator('.card').count(),10);
  await page.locator('#query').fill('стакан');assert(await page.locator('.card').count()>0);
  await page.locator('#region').selectOption('Москва');assert(await page.locator('.card').count()>0);
  for(const text of await page.locator('.delivery').allTextContents()) assert(/Москва|Россия/.test(text));
  await page.locator('#query').fill('zzzzнеизвестно');await page.waitForSelector('.empty');assert.equal(await page.locator('.card').count(),0);
  await page.locator('#reset').click();assert.equal(await page.locator('.card').count(),30);
  await page.locator('#query').fill('7 ВЕРСТ');assert.equal(await page.locator('.card').count(),1);await page.locator('#reset').click();
  await page.locator('.save-button').first().click();await page.locator('#saved-nav').click();assert.equal(await page.locator('.card').count(),1);
  await page.locator('.details-button').first().click();const note=page.locator('#detail-dialog textarea');await note.fill('Позвонить, запросить 20 кг <script>alert(1)</script>');await page.locator('#detail-dialog .close-dialog').click();
  await page.reload();await page.waitForSelector('.card');await page.locator('#saved-nav').click();assert.equal(await page.locator('.card').count(),1);await page.locator('.details-button').first().click();assert((await page.locator('#detail-dialog textarea').inputValue()).includes('<script>'));assert.equal(await page.locator('#detail-dialog script').count(),0);await page.locator('#detail-dialog .close-dialog').click();await page.locator('#reset').click();
  await page.locator('.compare-button').nth(0).click();assert(await page.locator('#compare-open').isDisabled());
  for(let i=1;i<4;i++) await page.locator('.compare-button').nth(i).click();
  await page.locator('.compare-button').nth(4).click();assert.equal(await page.locator('.compare-button[aria-pressed=true]').count(),4);assert((await page.locator('#toast').textContent()).includes('до 4'));
  await page.locator('#compare-open').click();assert.equal(await page.locator('#compare-content article').count(),4);
  await page.locator('#compare-content button').first().click();assert.equal(await page.locator('#compare-content article').count(),3);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#compare-dialog').evaluate(d=>d.open),false);
  await page.reload();await page.waitForSelector('.card');assert((await page.locator('#compare-count').textContent()).includes('3'));
  page.once('dialog',d=>d.accept());await page.locator('#clear-saved').click();assert.equal(await page.locator('#saved-count').textContent(),'0');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('suppliers:v1')).notes && Object.keys(JSON.parse(localStorage.getItem('suppliers:v1')).notes).length),0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}: горизонтальный скролл`);
  await page.screenshot({path:`test-results/${name}.png`,fullPage:true});assert.deepEqual(errors,[]);console.log(`${name}: поиск, фильтры, сброс, пустое состояние, сравнение, лимит, заметки, reload, очистка, XSS, ширина - OK`);await context.close();
}
const context=await browser.newContext();await context.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('blocked');}}));const page=await context.newPage();await page.goto(base);await page.waitForSelector('.card');assert(await page.locator('#storage-warning').isVisible());await page.locator('.save-button').first().click();assert.equal(await page.locator('#saved-count').textContent(),'1');await page.locator('.compare-button').first().click();await page.locator('.details-button').first().click();await page.locator('textarea').fill('Без storage');console.log('storage blocked: каталог, выбор, сравнение и заметка - OK');await context.close();
} finally {await browser.close();}
