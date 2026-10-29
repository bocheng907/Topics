const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = require('../functions/node_modules/firebase-admin');
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18298' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099' || process.env.GCLOUD_PROJECT !== 'demo-care-walkthrough') throw Error('Local demo only');
const app = admin.initializeApp({ projectId: 'demo-care-walkthrough' });
const db = app.firestore(), out = path.resolve(__dirname, '../output/playwright/chat-offline-20261025');
fs.mkdirSync(out, { recursive: true });
const results = [], contexts = [], dialogs = [];
async function until(fn, ms = 40000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await new Promise(r => setTimeout(r, 200)); } throw Error('Timed out verifying expected state'); }
(async () => {
  const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  const pid = randomUUID(), actors = [];
  try {
    for (const [role, name] of [['caregiver', '張美玲'], ['family', '陳雅婷']]) {
      const uid = randomUUID(), email = `${uid}@example.invalid`, password = `Localonly9-${randomUUID()}`;
      await app.auth().createUser({ uid, email, password });
      await db.doc(`users/${uid}`).set({ uid, email, role, displayName: name, name, activePatientId: pid, accountStatus: 'active', privacyConsentVersion: '2026-09-22.v2', privacyConsentAt: admin.firestore.Timestamp.now() });
      actors.push({ uid, email, password, role });
    }
    await db.doc(`patients/${pid}`).set({ name: '陳建國', caregivers: [actors[0].uid], families: [actors[1].uid], primaryFamilyUid: actors[1].uid, createdBy: actors[1].uid });
    for (const actor of actors) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: path.join(out, 'raw') } });
      contexts.push(ctx); actor.ctx = ctx;
      await ctx.route('**/*', route => { const u = new URL(route.request().url()); return ['localhost', '127.0.0.1'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol) ? route.continue() : route.abort(); });
      const page = await ctx.newPage(); actor.page = page;
      page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
      await page.goto('http://localhost:8086/login');
      await page.getByPlaceholder('請輸入 Email').fill(actor.email);
      await page.getByPlaceholder('請輸入密碼').fill(actor.password);
      await page.getByText('立即登入', { exact: true }).click();
      await page.waitForURL(`**/${actor.role}`, { timeout: 60000 });
      await page.getByRole('button', { name: '開啟選單', exact: true }).waitFor();
      await page.goto(`http://localhost:8086/${actor.role}/chat-room?patientId=${pid}&room=caregiver`);
      await page.getByRole('button', { name: '傳送照片', exact: true }).waitFor();
    }
    const [care, family] = actors, messages = db.collection(`chats/${pid}/messages`);
    const input = care.page.locator('textarea, input').filter({ visible: true }).last();
    const content = '明天上午回診，資料已放在藍色資料夾。';
    await input.fill(content);
    await care.ctx.setOffline(true);
    await care.page.getByRole('button', { name: '傳送訊息', exact: true }).dblclick();
    await care.page.waitForTimeout(2500);
    assert.equal((await messages.get()).size, 0);
    assert.equal(await input.inputValue(), content);
    await care.page.screenshot({ path: path.join(out, '01-offline-message-retained.png') });
    results.push('01-offline-no-server-message-draft-retained');
    await care.ctx.setOffline(false);
    await until(async () => (await messages.get()).size === 1);
    await until(async () => await input.inputValue() === '');
    await family.page.getByText(content, { exact: true }).waitFor();
    await care.page.waitForTimeout(1500);
    assert.equal((await messages.get()).size, 1);
    await family.page.screenshot({ path: path.join(out, '02-family-received-once.png') });
    results.push('02-reconnected-double-send-arrives-once');
    // A synthetic image only: no user photos are read or transmitted.
    const imageBuffer = await care.page.screenshot({ clip: { x: 0, y: 0, width: 50, height: 50 } });
    await care.ctx.setOffline(true);
    const chooserPromise = care.page.waitForEvent('filechooser');
    await care.page.getByRole('button', { name: '傳送照片', exact: true }).click();
    await (await chooserPromise).setFiles({ name: 'local-image.png', mimeType: 'image/png', buffer: imageBuffer });
    await care.page.waitForTimeout(2500);
    assert.equal((await messages.get()).size, 1);
    await care.page.screenshot({ path: path.join(out, '03-photo-offline.png') });
    results.push('03-offline-photo-not-published');
    await care.ctx.setOffline(false);
    await until(async () => (await messages.get()).docs.some(d => d.data().imageUrl), 60000);
    const photos = (await messages.get()).docs.filter(d => d.data().imageUrl);
    assert.equal(photos.length, 1);
    await until(() => family.page.locator('img').evaluateAll(imgs => imgs.some(img => img.src.includes('19398') && img.complete && img.naturalWidth > 0)));
    await family.page.screenshot({ path: path.join(out, '04-family-photo-loaded.png') });
    results.push('04-photo-resumes-once-and-family-displays-image');
    console.log('PASS', results.join('\nPASS '));
  } catch (error) {
    results.push({ failed: error.message }); process.exitCode = 1; console.error(error);
    for (let i = 0; i < actors.length; i++) await actors[i].page?.screenshot({ path: path.join(out, `failure-${i}.png`) }).catch(() => {});
  } finally {
    for (let i = 0; i < contexts.length; i++) { const p = actors[i].page; await contexts[i].close(); if (p?.video()) await p.video().saveAs(path.join(out, `${actors[i].role}.webm`)); }
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ environment: 'local-emulator', results, dialogs }, null, 2));
    await browser.close(); await app.delete();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
