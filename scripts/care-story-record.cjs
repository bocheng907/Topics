/* Real UI walkthrough with fictional people, isolated demo emulators only. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chatOnly = process.env.STORY_RESUME === 'chat';
const resume = process.env.STORY_RESUME === '1' || chatOnly;
const out = path.resolve(__dirname, '../output/playwright/' + (chatOnly ? 'care-story-chat' : resume ? 'care-story-continuation' : 'care-story-film'));
fs.mkdirSync(out, {recursive: true});
const chapters = [], actors = [], blocked = [], errors = [];
const password = 'CareTogether2026';
let invite = '';
let currentPage;
async function main() {
  const browser = await pw.chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH});
  async function actor(name) {
    const context = await browser.newContext({viewport: {width: 480, height: 960},
      recordVideo: {dir: path.join(out, 'raw'), size: {width: 480, height: 960}},
      permissions: ['clipboard-read', 'clipboard-write']});
    await context.route('**/*', route => {
      const u = new URL(route.request().url());
      if (['localhost', '127.0.0.1'].includes(u.hostname) || ['blob:', 'data:'].includes(u.protocol)) return route.continue();
      blocked.push(u.origin); return route.abort();
    });
    const page = await context.newPage();
    const started = Date.now();
    page.setDefaultTimeout(20000);
    page.on('pageerror', e => errors.push({actor: name, message: e.message}));
    page.on('dialog', async d => {
      const match = d.message().match(/邀請碼[：:]\s*([A-Z0-9]{6})/);
      if (match) invite = match[1];
      await page.waitForTimeout(650);
      await d.accept();
    });
    actors.push({name, page, context, started});
    await page.goto('http://localhost:8082', {timeout: 90000});
    await page.getByText('歡迎回來', {exact: true}).waitFor({timeout: 60000});
    return page;
  }
  function save() {
    fs.writeFileSync(path.join(out, 'recording.json'), JSON.stringify({chapters, blocked, errors}, null, 2));
  }
  async function step(name, page, action) {
    currentPage = page;
    const actor = actors.find(a => a.page === page);
    const item = {name, actor: actor.name, start: (Date.now() - actor.started) / 1000};
    chapters.push(item); save(); console.log('START', name);
    await action();
    await page.waitForTimeout(1800);
    await page.screenshot({path: path.join(out, `${chapters.length.toString().padStart(2, '0')}.png`)});
    item.end = (Date.now() - actor.started) / 1000; item.passed = true;
    save(); console.log('PASS', name);
  }
  async function register(page, name, email, family) {
    await page.getByText('去註冊', {exact: false}).click();
    await page.getByText('建立帳號', {exact: true}).waitFor();
    if (family) await page.getByText('家屬', {exact: true}).click();
    await page.getByPlaceholder('例如：王小明／陳阿姨').pressSequentially(name, {delay: 160});
    await page.getByPlaceholder('example@mail.com').pressSequentially(email, {delay: 45});
    await page.getByPlaceholder('至少 8 碼，包含小寫英文字母與數字').fill(password);
    if (family) {
      await page.getByPlaceholder('例如：0912345678').fill('0900000001');
      await page.getByPlaceholder('例如：0987654321').fill('0900000002');
    }
    await page.getByRole('checkbox').click();
    await page.waitForTimeout(1300);
    await page.getByText('完成並註冊', {exact: true}).click();
    await page.waitForURL(family ? '**/care-target/create' : '**/caregiver', {timeout: 30000});
  }
  async function send(page, other, message) {
    const received = other.getByText(message, {exact: true}).filter({visible: true}).last();
    if (await received.isVisible()) return;
    const input = page.getByPlaceholder('輸入訊息...').filter({visible: true});
    await input.pressSequentially(message, {delay: 65});
    await page.waitForTimeout(700);
    await input.locator('..').locator('[tabindex="0"]').last().click();
    await received.waitFor();
    assert.equal(await input.inputValue(), '');
  }
  async function login(page, email) {
    await page.getByPlaceholder('請輸入 Email').filter({visible: true}).fill(email);
    await page.getByPlaceholder('請輸入密碼').filter({visible: true}).fill(password);
    await page.getByText('立即登入', {exact: true}).filter({visible: true}).click();
    await page.waitForURL(email.includes('yijun') ? '**/caregiver' : '**/family');
  }
  try {
    const family = await actor('family');
    let caregiver;
    if (resume) {
      await login(family, 'yating.chen@family.example');
      caregiver = await actor('caregiver');
      await login(caregiver, 'yijun.lin@care.example');
    } else {
    await step('家屬陳雅婷建立帳號', family, () => register(family, '陳雅婷', 'yating@home.example', true));
    await step('建立陳建國的照護資料與邀請碼', family, async () => {
      await family.getByPlaceholder('例如：王爺爺').pressSequentially('陳建國', {delay: 160});
      await family.getByPlaceholder('例如：對普拿疼過敏').pressSequentially('喜歡早上到公園散步，起身時請在旁協助。午餐後習慣休息半小時。', {delay: 60});
      await family.getByText('確認建立', {exact: true}).click();
      await family.waitForURL('**/family'); assert.match(invite, /^[A-Z0-9]{6}$/);
    });
    caregiver = await actor('caregiver');
    await step('照護員林怡君建立帳號', caregiver, () => register(caregiver, '林怡君', 'yijun@nursing.example', false));
    await step('照護員輸入邀請碼申請加入', caregiver, async () => {
      await caregiver.getByText('綁定照護對象', {exact: true}).click();
      await caregiver.getByText('加入照顧對象', {exact: true}).waitFor();
      await caregiver.locator('input:visible').pressSequentially(invite, {delay: 180});
      await caregiver.getByText('立即加入', {exact: true}).click();
      await caregiver.getByText('待核准', {exact: true}).waitFor();
    });
    await step('家屬確認並核准照護員', family, async () => {
      await family.mouse.click(432, 40);
      await family.getByText('角色與邀請管理', {exact: true}).last().click();
      await family.getByText('核准', {exact: true}).click();
      await caregiver.getByText('進入已核准的長者', {exact: true}).waitFor();
    });
    await step('照護員進入陳建國的首頁', caregiver, async () => {
      await caregiver.getByText('進入已核准的長者', {exact: true}).click();
      await caregiver.waitForURL('**/caregiver');
      await caregiver.getByText('陳建國', {exact: true}).filter({visible: true}).waitFor();
    });
    }
    if (!chatOnly) {
    await step('登出後重新登入照護員帳號', caregiver, async () => {
      await caregiver.mouse.click(432, 40);
      await caregiver.getByText('登出系統', {exact: true}).filter({visible: true}).click();
      await caregiver.getByText('歡迎回來', {exact: true}).waitFor();
      await caregiver.getByPlaceholder('請輸入 Email').pressSequentially(resume ? 'yijun.lin@care.example' : 'yijun@nursing.example', {delay: 55});
      await caregiver.getByPlaceholder('請輸入密碼').fill(password);
      await caregiver.getByText('立即登入', {exact: true}).click();
      await caregiver.waitForURL('**/caregiver');
      await caregiver.getByText('陳建國', {exact: true}).filter({visible: true}).waitFor();
    });
    await step('填寫今日健康數據', caregiver, async () => {
      await caregiver.getByText('每日健康回報', {exact: true}).filter({visible: true}).click();
      await caregiver.getByPlaceholder('36.5', {exact: true}).fill('36.6');
      await caregiver.getByPlaceholder('80', {exact: true}).fill('76');
      await caregiver.getByPlaceholder('收縮壓', {exact: true}).fill('122');
      await caregiver.getByPlaceholder('舒張壓', {exact: true}).fill('78');
      await caregiver.getByPlaceholder('90', {exact: true}).fill('96');
      await caregiver.getByText('儲存', {exact: true}).click();
      await caregiver.waitForTimeout(2500);
    });
    await step('家屬查看同步的健康數據', family, async () => {
      if (!resume) await family.getByText('返回', {exact: true}).filter({visible: true}).click();
      await family.waitForURL('**/family');
      await family.getByText('36.6', {exact: true}).filter({visible: true}).waitFor();
      await family.getByText('76', {exact: true}).filter({visible: true}).waitFor();
    });
    }
    await step('家屬開啟與照護員的聊天室', family, async () => {
      await family.mouse.click(420, 926);
      await family.getByText('看護', {exact: true}).filter({visible: true}).click();
      await family.getByPlaceholder('輸入訊息...').waitFor();
    });
    await step('照護員開啟家屬聊天室', caregiver, async () => {
      if (!chatOnly) await caregiver.getByText('返回', {exact: true}).filter({visible: true}).click();
      await caregiver.mouse.click(420, 926);
      await caregiver.getByText('陳建國的家屬', {exact: true}).filter({visible: true}).click();
      await caregiver.getByPlaceholder('輸入訊息...').waitFor();
    });
    await step('怡君回報早上的照護狀況', caregiver, () => send(caregiver, family,
      '雅婷您好，陳伯伯今天早餐吃了半碗粥和一顆蛋，精神不錯。剛量完體溫 36.6 度，血壓 122／78，已經記錄在系統裡了。'));
    await step('雅婷詢問散步與膝蓋狀況', family, () => send(family, caregiver,
      '謝謝怡君，辛苦了！爸爸昨天說想出去走走，今天膝蓋還會不舒服嗎？'));
    await step('怡君回覆活動安排', caregiver, () => send(caregiver, family,
      '他剛才說沒有不舒服。我會先陪他在客廳走一小段，留意他的反應，想休息就坐下來。下午再跟您說狀況。'));
    await step('雅婷告知探訪時間', family, () => send(family, caregiver,
      '好，麻煩您了。我今天下午四點左右會過去，順便帶爸爸喜歡的水果。'));
    await step('確認雙方收到完整對話', caregiver, () => send(caregiver, family,
      '好的，我會先跟陳伯伯說您下午來，他一定很開心。到時候見！'));
    await step('家屬重新開啟仍可查看對話', family, async () => {
      await family.getByText('＜', {exact: true}).filter({visible: true}).click();
      await family.getByText('看護', {exact: true}).filter({visible: true}).click();
      await family.getByText('好的，我會先跟陳伯伯說您下午來，他一定很開心。到時候見！', {exact: true}).filter({visible: true}).last().waitFor();
    });
  } catch (e) {
    console.error('FAILED', e.message);
    errors.push({failure: e.message});
    if (currentPage) {
      await currentPage.screenshot({path: path.join(out, 'failure.png')});
      fs.writeFileSync(path.join(out, 'failure.txt'), await currentPage.locator('body').innerText());
    }
    process.exitCode = 1;
  } finally {
    save();
    for (const item of actors) {
      await item.context.close();
      await item.page.video().saveAs(path.join(out, item.name + '.webm'));
    }
    await browser.close();
    console.log('ARTIFACTS', out);
  }
}
main().catch(e => {console.error(e); process.exitCode = 1;});
