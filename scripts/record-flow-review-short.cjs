// Continuous local-only browser acceptance recording. No production credentials.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18298'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:19099')throw Error('Local emulators required');
const retry=process.argv.includes('--retry');
const out=path.resolve(__dirname,'../output/playwright/flow-review-20261020-short'+(retry?'-retry':''));
fs.mkdirSync(out,{recursive:true});
const actors={},steps=[],errors=[],blocked=[];
const base='http://localhost:8086', password='LocalCare2026!';
const text=(p,s)=>p.getByText(s,{exact:true}).filter({visible:true}).last();
let browser;
const save=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({environment:'Local emulators; synthetic accounts; continuous real browser UI recording, not phone or production',steps,errors,blocked},null,2));
async function actor(name){
 const context=await browser.newContext({viewport:{width:480,height:960},timezoneId:'Asia/Taipei',recordVideo:{dir:path.join(out,'raw'),size:{width:480,height:960}},permissions:['clipboard-read','clipboard-write']});
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(['localhost','127.0.0.1'].includes(u.hostname)||['blob:','data:'].includes(u.protocol))return r.continue();blocked.push(u.origin);return r.abort();});
 const p=await context.newPage();p.setDefaultTimeout(12000);actors[name]={context,page:p,start:Date.now()};
 p.on('pageerror',e=>errors.push({actor:name,error:e.message}));p.on('dialog',async d=>{console.log('DIALOG',d.message());await d.accept();});
 await p.goto(base);await text(p,'歡迎回來').waitFor();return p;
}
async function step(name,key,fn){
 const a=actors[key],s={name,actor:key,start:(Date.now()-a.start)/1000};steps.push(s);save();
 try{await fn(a.page);await a.page.waitForTimeout(1800);s.passed=true;}catch(e){s.passed=false;s.error=e.message;console.log('FAILED',name,e.message.slice(0,160));}
 finally{s.end=(Date.now()-a.start)/1000;await a.page.screenshot({path:path.join(out,String(steps.length).padStart(2,'0')+'.png')});save();console.log('STEP',steps.length,s.passed,name);}
}
async function login(p,email){await p.getByPlaceholder('請輸入 Email').fill(email);await p.getByPlaceholder('請輸入密碼',{exact:true}).fill(password);await text(p,'立即登入').click();}
async function download(p,key){
 await p.goto(base+'/personal-data-export');await p.getByPlaceholder('請輸入目前密碼',{exact:true}).fill(password);await text(p,'重新驗證並產生 JSON').click();await text(p,'已產生匯出檔').waitFor({timeout:45000});
 const ready=p.waitForEvent('download');await text(p,'下載 JSON').click();const d=await ready;const file=path.join(out,key+'-export.json');await d.saveAs(file);return JSON.parse(fs.readFileSync(file,'utf8'));
}
(async()=>{
 browser=await pw.chromium.launch({headless:true});
 try{
  await actor('family');await actor('caregiver');
  await step('家屬重新登入與查看長者首頁','family',async p=>{await login(p,'yating@care.example');await text(p,'陳建國').waitFor();await text(p,retry?'36.7':'36.6').waitFor();});
  await step('照護員登入與目前長者','caregiver',async p=>{await login(p,'yijun@care.example');await text(p,'陳建國').waitFor();});
  await step('照護員新增健康回報','caregiver',async p=>{await text(p,'每日健康回報').click();for(const [a,b] of [['36.5','36.7'],['80','77'],['收縮壓','121'],['舒張壓','79'],['90','97']])await p.getByPlaceholder(a,{exact:true}).fill(b);await text(p,'儲存').click();await text(p,'體溫趨勢').waitFor();});
  await step('家屬首頁即時更新健康數據','family',async p=>{await text(p,'36.7').waitFor();await text(p,'77').waitFor();});
  await step('照護員傳送照護訊息','caregiver',async p=>{await p.goto(base+'/caregiver/chat-list');await text(p,'陳建國的家屬').click();const i=p.getByPlaceholder('輸入訊息...').filter({visible:true});await i.fill('雅婷，回診資料已整理好放在玄關，我也把提醒補到交接記事了。');await i.locator('..').locator('[tabindex="0"]').last().click();await text(p,'雅婷，回診資料已整理好放在玄關，我也把提醒補到交接記事了。').waitFor();});
  await step('家屬收訊並回覆','family',async p=>{await p.goto(base+'/family/chat-list');await text(p,'陳建國').waitFor();await text(p,'看護').click();await p.waitForURL('**/family/chat-room**');await text(p,'雅婷，回診資料已整理好放在玄關，我也把提醒補到交接記事了。').waitFor();const i=p.getByPlaceholder('輸入訊息...').filter({visible:true});await i.fill('收到，謝謝！我到了會先看交接記事，再一起確認出門要帶的東西。');await i.locator('..').locator('[tabindex="0"]').last().click();});
  await step('照護員確認收到家屬回覆','caregiver',async p=>{await text(p,'收到，謝謝！我到了會先看交接記事，再一起確認出門要帶的東西。').waitFor();});
  await step('家屬查看手冊與接班狀態','family',async p=>{await p.goto(base+'/family/handbook');await p.locator('textarea').first().waitFor();assert((await p.locator('textarea').first().inputValue()).includes('下午四點'));await p.getByText('已確認此版本').filter({visible:true}).first().scrollIntoViewIfNeeded();});
  await step('照護員閱讀已確認的手冊','caregiver',async p=>{await p.goto(base+'/caregiver/handbook');await p.getByText('已確認此版本').filter({visible:true}).first().scrollIntoViewIfNeeded();});
  await step('照護員修改回診交接記事','caregiver',async p=>{await p.goto(base+'/caregiver/notebook');await text(p,'回診前交接提醒').waitFor();await text(p,'編輯').click();await p.getByPlaceholder('可以記錄長輩狀況、注意事項、提醒...').fill('藍色資料夾已放在玄關，雅婷下午四點來時會一起確認回診資料。已在聊天室告知家屬。');await text(p,'儲存').click();await p.getByText('已在聊天室告知家屬。',{exact:false}).filter({visible:true}).first().waitFor();});
  await step('家屬開啟社群文章並新增留言','family',async p=>{await p.goto(base+'/family/community');await text(p,'回診前把資料集中，交接更安心').click();const i=p.getByPlaceholder('留個言鼓勵一下吧...');await i.fill('後來也把交接提醒補在記事本，家人來之前就能先確認進度。');await i.locator('..').locator('[tabindex="0"]').last().click();await text(p,'後來也把交接提醒補在記事本，家人來之前就能先確認進度。').waitFor();});
  await step('家屬匯出聊天、文章與留言','family',async p=>{const d=await download(p,'family');assert(JSON.stringify(d).includes('回診前把資料集中'));assert(JSON.stringify(d).includes('收到，謝謝'));});
  await step('照護員匯出健康、記事與聊天','caregiver',async p=>{const d=await download(p,'caregiver');assert(d.records.health_records.length>=2);assert(JSON.stringify(d).includes('已在聊天室告知家屬'));});
  await step('一般照護員不能查看 Audit Log','caregiver',async p=>{await p.goto(base+'/audit-logs');await text(p,'僅限授權管理員查閱').waitFor();});
  await step('本機授權管理員查看操作紀錄','family',async p=>{await p.goto(base+'/audit-logs');await p.getByPlaceholder('搜尋已載入紀錄：操作、身分或資源').waitFor();await p.getByText('後端資料變更事件',{exact:true}).first().waitFor();});
  await step('照護員申請刪除帳號並登出','caregiver',async p=>{await p.goto(base+'/account-deletion');await p.getByPlaceholder('請輸入目前密碼以重新驗證').fill(password);await text(p,'確認申請刪除').click();await text(p,'歡迎回來').waitFor();});
  await step('刪除緩衝期登入被導向取消頁','caregiver',async p=>{await login(p,'yijun@care.example');await text(p,'帳號已排定刪除').waitFor();});
  await step('取消刪除並恢復正常登入','caregiver',async p=>{await p.getByPlaceholder('請輸入目前密碼以重新驗證').fill(password);await text(p,'取消帳號刪除').click();await text(p,'歡迎回來').waitFor();await login(p,'yijun@care.example');await text(p,'陳建國').waitFor();});
 }finally{
  await Promise.all(Object.entries(actors).map(async([name,a])=>{await a.context.close();await a.page.video().saveAs(path.join(out,name+'.webm'));}));save();await browser.close();
 }
 console.log('FINISHED',JSON.stringify({out,passed:steps.filter(s=>s.passed).length,total:steps.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
