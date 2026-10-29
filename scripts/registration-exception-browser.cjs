const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = require('../functions/node_modules/firebase-admin');
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18298' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099' || process.env.GCLOUD_PROJECT !== 'demo-care-walkthrough') throw Error('Isolated demo emulators required');
const out = path.resolve(__dirname, process.env.REGISTRATION_OUTPUT || '../output/playwright/registration-exceptions-20261025');
const app = admin.initializeApp({ projectId: 'demo-care-walkthrough' });
const results = [], contexts = [];
fs.mkdirSync(out, { recursive: true });
async function check(label, fn) {
  try { await fn(); results.push({ label, status: 'pass' }); console.log('PASS ' + label); }
  catch (error) { results.push({ label, status: 'fail', message: error.message }); throw error; }
}
(async () => {
  const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  async function page() {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: path.join(out, 'raw') } });
    contexts.push(ctx);
    await ctx.route('**/*', route => { const u = new URL(route.request().url()); return ['localhost', '127.0.0.1'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol) ? route.continue() : route.abort(); });
    const p = await ctx.newPage(); p.on('dialog', d => d.accept());
    await p.goto('http://localhost:8086/register');
    await p.getByPlaceholder('example@mail.com').waitFor();
    return p;
  }
  try {
    const p = await page(), email = `${randomUUID()}@example.invalid`, password = `Localonly9-${randomUUID()}`;
    const submit = p.getByRole('button', { name: '完成並註冊', exact: true });
    await p.getByPlaceholder('例如：王小明／陳阿姨').fill('張美玲');
    await p.getByPlaceholder('example@mail.com').fill(email);
    await p.getByPlaceholder('至少 8 碼，包含小寫英文字母與數字').fill('abc');
    await check('01-no-consent-submit-disabled', async () => {
      assert.equal(await submit.isDisabled(), true);
      await assert.rejects(app.auth().getUserByEmail(email), { code: 'auth/user-not-found' });
      await submit.scrollIntoViewIfNeeded();
      await p.screenshot({ path: path.join(out, '01-no-consent.png') });
    });
    await p.getByRole('checkbox').click();
    await check('02-weak-password-no-account-created', async () => {
      await submit.click();
      await p.getByRole('alert').filter({ hasText: '密碼至少 8 碼' }).waitFor();
      await assert.rejects(app.auth().getUserByEmail(email), { code: 'auth/user-not-found' });
      await p.screenshot({ path: path.join(out, '02-weak-password.png') });
    });
    await p.getByPlaceholder('至少 8 碼，包含小寫英文字母與數字').fill(password);
    let uid;
    await check('03-valid-caregiver-registration-and-consent', async () => {
      await submit.click();
      await p.waitForURL('**/caregiver', { timeout: 60000 });
      uid = (await app.auth().getUserByEmail(email)).uid;
      const profiles = await app.firestore().collection('users').where('uid', '==', uid).get();
      assert.equal(profiles.size, 1);
      const profile = profiles.docs[0].data();
      assert.equal(profile.role, 'caregiver');
      assert.equal(profile.privacyConsent.accepted, true);
      assert.equal(profile.privacyConsent.version, '2026-09-22.v2');
      assert.ok(profile.privacyConsent.acceptedAt);
      await p.getByRole('button', { name: '開啟選單' }).waitFor();
      await p.screenshot({ path: path.join(out, '03-registered-home.png') });
    });
    const duplicate = await page();
    await duplicate.getByPlaceholder('例如：王小明／陳阿姨').fill('不可覆寫原帳號');
    await duplicate.getByPlaceholder('example@mail.com').fill(email);
    await duplicate.getByPlaceholder('至少 8 碼，包含小寫英文字母與數字').fill(password);
    await duplicate.getByRole('checkbox').click();
    await check('04-duplicate-email-friendly-message-profile-unchanged', async () => {
      await duplicate.getByRole('button', { name: '完成並註冊', exact: true }).click();
      const alert = duplicate.getByRole('alert').filter({ hasText: '此 Email 已經註冊' });
      await alert.waitFor({ timeout: 45000 });
      assert.doesNotMatch(await alert.innerText(), /auth\/|FirebaseError/);
      assert.equal((await app.auth().getUserByEmail(email)).uid, uid);
      const profiles = await app.firestore().collection('users').where('uid', '==', uid).get();
      assert.equal(profiles.size, 1);
      assert.equal(profiles.docs[0].data().displayName, '張美玲');
      await duplicate.screenshot({ path: path.join(out, '04-duplicate-email.png') });
    });
  } catch (error) {
    for (let i = 0; i < contexts.length; i++) await contexts[i].pages()[0]?.screenshot({ path: path.join(out, `failure-${i}.png`) }).catch(() => {});
    console.error(error); process.exitCode = 1;
  } finally {
    for (let i = 0; i < contexts.length; i++) { const p = contexts[i].pages()[0]; await contexts[i].close(); if (p?.video()) await p.video().saveAs(path.join(out, `registration-${i}.webm`)); }
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ environment: 'local-emulator', results }, null, 2));
    await browser.close(); await app.delete();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
