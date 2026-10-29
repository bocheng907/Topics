/* Local-only interactive recording harness. Run against firebase.walkthrough.json. */
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = path.resolve(__dirname, '../output/playwright/care-story');
fs.mkdirSync(out, {recursive: true});
(async () => {
  const browser = await pw.chromium.launch({headless: true,
    executablePath: process.env.CHROMIUM_PATH});
  const contexts = [];
  const blocked = [];
  const errors = [];
  const story = {};
  const start = Date.now();
  const chapters = [];
  async function actor(name) {
    const context = await browser.newContext({viewport: {width: 480, height: 960},
      recordVideo: {dir: path.join(out, 'raw'), size: {width: 480, height: 960}},
      permissions: ['clipboard-read', 'clipboard-write']});
    await context.route('**/*', route => {
      const u = new URL(route.request().url());
      if (['localhost', '127.0.0.1'].includes(u.hostname) ||
          ['data:', 'blob:'].includes(u.protocol)) return route.continue();
      blocked.push(u.origin);
      return route.abort();
    });
    const page = await context.newPage();
    const videoStart = Date.now();
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => {
      if (dialog.message().includes('邀請碼')) story.invite = dialog.message().match(/[A-Z0-9]{6}/)?.[0];
      console.log('DIALOG:', dialog.message());
      await dialog.accept();
    });
    contexts.push({name, context, page, videoStart});
    return page;
  }
  async function shot(page, name) {
    await page.screenshot({path: path.join(out, name + '.png')});
    chapters.push({name, actor: contexts.find(x => x.page === page).name,
      seconds: (Date.now() - contexts.find(x => x.page === page).videoStart) / 1000});
  }
  async function finish() {
    for (const item of contexts) {
      await item.context.close();
      await item.page.video().saveAs(path.join(out, item.name + '.webm'));
    }
    fs.writeFileSync(path.join(out, 'recording.json'), JSON.stringify({start, chapters, blocked, errors}, null, 2));
    await browser.close();
  }
  const family = await actor('family');
  console.log('READY');
  const lines = readline.createInterface({input: process.stdin, terminal: false});
  for await (const line of lines) {
    try {
      if (!line.trim()) continue;
      const result = await eval('(async () => {' + line + '\n})()');
      console.log('RESULT', JSON.stringify(result ?? 'ok'));
    } catch (error) {
      console.log('ERROR', error.message);
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
