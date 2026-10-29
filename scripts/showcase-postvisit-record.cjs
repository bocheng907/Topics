const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const c=require('./showcase-common.cjs'),pw=require(process.env.PLAYWRIGHT_MODULE);
const out=path.join(c.root,'output/playwright/care-postvisit'),base='http://localhost:8084';
const medication='10/16 回診後已核對藥袋，藥品、劑量及時段維持原資料。請查看「10/16 回診用藥整理」，早餐後與晚餐後各依藥單記錄；舊藥單保留查閱，不重複使用舊提醒。';
const other='10/16 回診資料已放回客廳藍色資料夾。雅婷負責整理門診資料，志明完成接送，怡君接續日常照護；交班前請核對手冊、藥單與當日紀錄，有不清楚的地方先在聊天室確認。';
const message='爸爸回診的資料已整理好了，藥單和看護手冊都已更新，藍色資料夾放回客廳櫃子。怡君，接班時麻煩先看手冊，再確認今天的用藥紀錄。';
const reply='收到，我已閱讀新版手冊，也核對了藥單。會依原定時段記錄照護與用藥，交班前再確認資料夾，有問題會在這裡和妳確認。';
const tx=(p,s)=>p.getByText(s,{exact:true}).filter({visible:true}).last();
async function main(){
 const s=c.state(),b=await pw.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH}),actors=[],chapters=[],dialogs=[],errors=[];let current;
 fs.mkdirSync(out,{recursive:true});const save=()=>fs.writeFileSync(path.join(out,'recording.json'),JSON.stringify({chapters,dialogs,errors,synthetic:true,actualRecordedAt:new Date().toISOString()},null,2));
 async function login(key){const a=s.actors.find(x=>x.key===key),ctx=await b.newContext({viewport:{width:480,height:960},timezoneId:'Asia/Taipei',recordVideo:{dir:path.join(out,'raw'),size:{width:480,height:960}}}),p=await ctx.newPage();p.setDefaultTimeout(30000);p.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});p.on('pageerror',e=>errors.push(e.message));actors.push({key,role:a.role,p,ctx,start:Date.now()});await p.goto(base,{timeout:120000});await p.getByPlaceholder('請輸入 Email').fill(a.email);await p.getByPlaceholder('請輸入密碼').fill(a.password);await tx(p,'立即登入').click();await p.waitForURL(`**/${a.role}`,{timeout:60000});await tx(p,'陳建國').waitFor();return p;}
 async function home(p){const a=actors.find(a=>a.p===p);await p.goto(base);await p.waitForURL(`**/${a.role}`,{timeout:60000});await tx(p,'陳建國').waitFor();await p.waitForTimeout(1500);}
 async function book(p){await p.mouse.click(432,40);await tx(p,'看護手冊').click();await p.waitForTimeout(1600);assert.equal(await tx(p,'無法載入看護手冊，請稍後再試。').count(),0);}
 async function step(name,description,p,fn){current=p;const a=actors.find(a=>a.p===p),ch={name,description,actor:a.key,start:(Date.now()-a.start)/1000};chapters.push(ch);save();console.log('START '+name);await fn();await p.waitForTimeout(2200);await p.screenshot({path:path.join(out,'chapter-'+String(chapters.length).padStart(2,'0')+'.png')});ch.end=(Date.now()-a.start)/1000;ch.passed=true;save();console.log('PASS '+name);}
 async function send(p,receiver,msg){const input=p.getByPlaceholder('輸入訊息...').filter({visible:true});if(!(await tx(p,msg).count())){await input.fill(msg);await input.locator('..').locator('[tabindex="0"]').last().click();}await tx(receiver,msg).waitFor();assert.equal(await input.inputValue(),'');}
 try{
 const f=await login('family'),g=await login('caregiver');await book(g);
 await step('01 家屬開啟看護手冊','家屬現在可以讀取原有手冊，九個照護區段保留。',f,async()=>{await book(f);assert.equal(await f.locator('textarea').filter({visible:true}).count(),9);});
 await step('02 更新回診後交接','補上用藥核對與交班重點，不變更既有藥品或劑量。',f,async()=>{const fields=f.locator('textarea').filter({visible:true});await fields.nth(1).fill(medication);await fields.nth(8).fill(other);});
 await step('03 儲存並前往聊天','成功提示與前往聊天室確認回呼都會正常執行。',f,async()=>{await tx(f,'儲存手冊').click();await f.getByPlaceholder('輸入訊息...').filter({visible:true}).waitFor();assert.ok(dialogs.some(t=>t.includes('看護手冊已更新')));assert.ok(dialogs.some(t=>t.includes('是否前往聊天室')));});
 await step('04 照護員即時讀取','照護員已開啟的手冊自動收到新內容，沒有編輯欄位。',g,async()=>{await tx(g,medication).waitFor();await tx(g,other).waitFor();assert.equal(await g.locator('textarea').filter({visible:true}).count(),0);await tx(g,medication).scrollIntoViewIfNeeded();});
 await home(g);await g.mouse.click(420,926);await tx(g,'陳建國的家屬').click();await g.getByPlaceholder('輸入訊息...').filter({visible:true}).waitFor();
 await step('05 家屬通知交接','家屬傳送交接訊息，照護員端同步收到。',f,()=>send(f,g,message));
 await step('06 照護員確認收到','照護員確認已讀手冊與藥單，家屬端收到回覆。',g,()=>send(g,f,reply));
 await home(f);await step('07 新舊藥單保留查閱','回診用藥整理已加入，原門診藥單仍在，不覆蓋歷史。',f,async()=>{await tx(f,'藥單紀錄').click();await tx(f,'10/16 回診用藥整理').waitFor();await tx(f,'10月門診用藥').waitFor();});
 await home(g);await step('08 回診交接記事','記事本串起藍色資料夾、藥袋核對與後續交班。',g,async()=>{await g.mouse.click(432,40);await tx(g,'記事本').click();await tx(g,'回診後交接與藥袋核對').waitFor();});
 await home(f);await step('09 回診與交接行程','十月十六日顯示回診與回診後交接兩個相關行程。',f,async()=>{await f.mouse.click(180,926);await tx(f,'16').click();await tx(f,'家庭醫學科回診').waitFor();await tx(f,'回診後照護交接').waitFor();});
 }catch(e){errors.push(e.message);if(current){await current.screenshot({path:path.join(out,'error.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'error-body.txt'),await current.locator('body').innerText());}throw e;}
 finally{for(const a of actors){await a.ctx.close();await a.p.video().saveAs(path.join(out,a.key+'.webm'));}await b.close();save();}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
