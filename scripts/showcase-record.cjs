const fs=require('node:fs'),path=require('node:path');const assert=require('node:assert/strict');const c=require('./showcase-common.cjs');const pw=require(process.env.PLAYWRIGHT_MODULE);
const out=path.join(c.root,'output/playwright/care-week');const chapters=[],actors=[],errors=[];let current;
const save=()=>fs.writeFileSync(path.join(out,'recording.json'),JSON.stringify({chapters,errors},null,2));
const text=(p,t)=>p.getByText(t,{exact:true}).filter({visible:true}).last();
async function main(){
 const s=c.state();const b=await pw.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 async function actor(key){const a=s.actors.find(a=>a.key===key);const ctx=await b.newContext({viewport:{width:480,height:960},timezoneId:'Asia/Taipei',recordVideo:{dir:path.join(out,'raw'),size:{width:480,height:960}}});const p=await ctx.newPage();p.setDefaultTimeout(25000);p.on('dialog',async d=>d.accept());p.on('pageerror',e=>errors.push({actor:key,message:e.message}));actors.push({key,a,p,ctx,start:Date.now()});await p.goto('http://localhost:8083',{timeout:90000});await p.getByPlaceholder('請輸入 Email').waitFor();return p;}
 async function step(name,description,p,fn){current=p;const a=actors.find(a=>a.p===p),ch={name,description,actor:a.key,start:(Date.now()-a.start)/1000};chapters.push(ch);save();console.log('START',name);await fn();await p.waitForTimeout(4500);await p.screenshot({path:path.join(out,`chapter-${String(chapters.length).padStart(2,'0')}.png`)});ch.end=(Date.now()-a.start)/1000;ch.passed=true;save();console.log('PASS',name);}
 async function login(p){const a=actors.find(a=>a.p===p).a;await p.getByPlaceholder('請輸入 Email').fill(a.email);await p.getByPlaceholder('請輸入密碼').fill(a.password);await text(p,'立即登入').click();await p.waitForURL(`**/${a.role}`,{timeout:45000});await text(p,'陳建國').waitFor();}
 async function home(p){const role=actors.find(a=>a.p===p).a.role;await p.goto('http://localhost:8083');await p.waitForURL(`**/${role}`,{timeout:45000});await text(p,'陳建國').waitFor();await p.waitForTimeout(2000);}
 async function send(p,other,message){const input=p.getByPlaceholder('輸入訊息...').filter({visible:true});await input.pressSequentially(message,{delay:65});await input.locator('..').locator('[tabindex="0"]').last().click();await text(other,message).waitFor();assert.equal(await input.inputValue(),'');}
 try{
 const f=await actor('family');await step('01 家屬登入','陳雅婷登入後，查看陳建國的照護資訊。',f,()=>login(f));
 await step('02 門診藥單紀錄','打開十月門診藥單，確認來源日期與備註。',f,async()=>{await text(f,'藥單紀錄').click();await text(f,'10月門診用藥').waitFor();});
 await step('03 藥品內容與用法','查看兩項藥品、劑量與服用時段。',f,async()=>{await text(f,'查看詳情').click();await text(f,'Amlodipine 5 mg').waitFor();await text(f,'Metformin 500 mg').waitFor();});
 await home(f);await step('04 今日健康數據','體溫、心跳、血壓及血糖集中呈現。',f,async()=>{await text(f,'查看圖表').click();await text(f,'本日紀錄').waitFor();});
 await step('05 一週健康趨勢','以七天量測紀錄觀察變化，回診時方便說明。',f,async()=>{await text(f,'歷史趨勢').click();await f.waitForTimeout(2500);});
 await home(f);await step('06 明日回診行程','10 月 16 日上午 9:30，到門診一樓報到。',f,async()=>{await f.mouse.click(180,926);await text(f,'16').click();await text(f,'家庭醫學科回診').first().waitFor();});
 const care=await actor('caregiver');await step('07 照護員登入','林怡君登入同一位長者的照護工作頁。',care,()=>login(care));
 await step('08 一週照護記事','飲食、活動與接送安排，留下可以交接的紀錄。',care,async()=>{await care.mouse.click(432,40);await text(care,'記事本').click();await text(care,'回診物品已備妥').waitFor();await care.mouse.move(250,600);await care.mouse.wheel(0,350);});
 await home(care);await step('09 新增晚間健康回報','照護員輸入本次量測，再儲存到同一照護群組。',care,async()=>{await text(care,'每日健康回報').click();await care.getByPlaceholder('36.5').fill('36.7');await care.getByPlaceholder('80').fill('78');await care.getByPlaceholder('收縮壓').fill('130');await care.getByPlaceholder('舒張壓').fill('79');await care.getByPlaceholder('90').fill('108');await text(care,'儲存').click();await care.waitForTimeout(2200);});
 await home(f);await step('10 家屬端查看新紀錄','重新查看家屬首頁，確認最新體溫已變為 36.7。',f,async()=>{await text(f,'36.7').waitFor();});
 await step('11 照護溝通紀錄','共用聊天室保留本週日常與明日回診安排。',f,async()=>{await f.mouse.click(420,926);await text(f,'看護').click();await text(f,'謝謝，明天我八點半先到家，再一起確認資料。').waitFor();});
 await home(care);await care.mouse.click(420,926);await text(care,'陳建國的家屬').click();await care.getByPlaceholder('輸入訊息...').waitFor();
 await step('12 照護員即時回報','傳送新的交接訊息，家屬端確認即時收到。',care,()=>send(care,f,'晚間量測已更新，伯伯準備休息了。明天回診的藍色資料夾放在客廳櫃子上。'));
 await step('13 家屬回覆交接','家屬確認看診時間與物品，照護員同步收到回覆。',f,()=>send(f,care,'收到，謝謝怡君。我明天八點半到家，會帶著資料夾一起去回診。'));
 const brother=await actor('brother');await login(brother);await brother.mouse.click(420,926);await text(brother,'家庭群組').click();await brother.getByPlaceholder('輸入訊息...').waitFor();
 await home(f);await f.mouse.click(420,926);await step('14 家屬專用群組','兩位家屬在家庭群組協調，與照護聊天室分開。',f,async()=>{await text(f,'家庭群組').click();await text(f,'好，醫師說明的重點我會記下來，回家後再和怡君交接。').waitFor();});
 await step('15 家人確認接送','陳志明傳送接送安排，雅婷端確認訊息到達。',brother,()=>send(brother,f,'我明天八點四十五分到門口，先讓妳和爸爸下車，我停好車再去門診會合。'));
 await step('16 家屬確認完成','在家庭群組完成最後一次交接確認。',f,()=>send(f,brother,'好，健保卡和藥袋都準備好了，明天見。'));
 await home(f);await step('17 相關通知集中查看','聊天與照護操作產生通知，僅送達此群組帳號。',f,async()=>{await f.mouse.click(300,926);await text(f,'通知').waitFor();await f.waitForTimeout(2500);});
 }catch(e){if(current)await current.screenshot({path:path.join(out,'recording-error.png')}).catch(()=>{});errors.push({fatal:e.message});save();throw e;}
 finally{for(const a of actors){await a.ctx.close();await a.p.video().saveAs(path.join(out,a.key+'.webm'));}await b.close();save();}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
