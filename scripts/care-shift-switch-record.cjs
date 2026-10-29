const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const c=require('./care-shift-common.cjs'),pw=require(process.env.PLAYWRIGHT_MODULE);
const tx=(p,t)=>p.getByText(t,{exact:true}).filter({visible:true}).last();
const message='雅婷您好，我是今天接班的美玲，已讀過建國伯伯的手冊、回診藥單與聊天室的交接內容。藍色資料夾的位置也確認了，接下來有狀況會在這裡回報。';
const reply='美玲您好，謝謝妳先確認交接資料。爸爸喜歡聊種花，走路時麻煩在旁陪同，有需要隨時在這裡聯絡。';
async function main(){const s=c.state(),old=c.priorState(),{db}=await c.admin(),b=await pw.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH}),actors=[],chapters=[],errors=[];let current;
 const save=()=>fs.writeFileSync(path.join(c.out,'switch-recording.json'),JSON.stringify({chapters,errors,synthetic:true,actualRecordedAt:new Date().toISOString()},null,2));
 async function login(a,key){const ctx=await b.newContext({viewport:{width:480,height:960},timezoneId:'Asia/Taipei',recordVideo:{dir:path.join(c.out,'raw'),size:{width:480,height:960}}}),p=await ctx.newPage();actors.push({a,key,p,ctx,start:Date.now()});p.setDefaultTimeout(30000);p.on('dialog',d=>d.accept());p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:8085',{timeout:90000});await p.getByPlaceholder('請輸入 Email').fill(a.email);await p.getByPlaceholder('請輸入密碼').fill(a.password);await tx(p,'立即登入').click();await p.waitForURL(`**/${a.role}`,{timeout:60000});await p.waitForTimeout(2000);return p;}
 async function home(p){const a=actors.find(a=>a.p===p).a;await p.goto('http://localhost:8085');await p.waitForURL(`**/${a.role}`);await p.waitForTimeout(1200);}
 async function step(name,description,p,fn){current=p;const a=actors.find(a=>a.p===p),ch={name,description,actor:a.key,start:(Date.now()-a.start)/1000};chapters.push(ch);save();console.log('START '+name);await fn();await p.waitForTimeout(2400);await p.screenshot({path:path.join(c.out,'switch-'+String(chapters.length).padStart(2,'0')+'.png')});ch.end=(Date.now()-a.start)/1000;ch.passed=true;save();console.log('PASS '+name);}
 async function switchTo(p,name){await home(p);await p.mouse.click(432,40);await tx(p,'選擇照顧對象').click();await tx(p,'陳建國').waitFor();await tx(p,'林秀英').waitFor();await tx(p,name).click();await p.waitForURL('**/caregiver');await tx(p,name).waitFor();}
 async function send(p,receiver,text){const input=p.getByPlaceholder('輸入訊息...').filter({visible:true});if(!(await tx(p,text).count())){await input.fill(text);await input.locator('..').locator('[tabindex="0"]').last().click();}await tx(receiver,text).waitFor();}
 try{
 const m=await login(s.actors[0],'meiling-switch'),f=await login(old.actors[0],'yating-switch');
 await step('07 切換到陳建國','從選單選擇照顧對象，同一位照護員可以切換兩位長者。',m,()=>switchTo(m,'陳建國'));
 await step('08 核對建國伯伯手冊','陳建國顯示回診交接與藍色資料夾，不是林秀英的相簿安排。',m,async()=>{await m.mouse.click(432,40);await tx(m,'看護手冊').click();await m.getByText('10/16 回診後已核對藥袋',{exact:false}).filter({visible:true}).waitFor();assert.equal(await tx(m,'早餐後喜歡坐在窗邊聽台語老歌，下午一起整理相簿。').count(),0);});
 await home(m);await step('09 核對建國伯伯藥單','切換後顯示陳建國的兩張藥單，保留原本與回診整理版本。',m,async()=>{await tx(m,'查看藥單紀錄').click();await tx(m,'10月門診用藥').waitFor();await tx(m,'10/16 回診用藥整理').waitFor();});
 await home(m);await step('10 私人記事與交接分開','記事本只顯示本人記事；跨班交接使用共享手冊與群組聊天。',m,async()=>{await m.mouse.click(432,40);await tx(m,'記事本').click();await m.waitForTimeout(2000);assert.equal(await tx(m,'回診後交接與藥袋核對').count(),0);assert.equal(await tx(m,'秀英阿姨的相簿時間').count(),0);});
 await home(m);await m.mouse.click(420,926);await tx(m,'陳建國的家屬').click();await f.mouse.click(420,926);await tx(f,'看護').click();
 await step('11 美玲與雅婷完成交接','接班訊息送到陳建國群組，由雅婷接收與回覆。',m,async()=>{await send(m,f,message);await send(f,m,reply);});
 await step('12 切回林秀英','切回另一位長者，確認沒有殘留陳建國的藥單。',m,async()=>{await switchTo(m,'林秀英');await tx(m,'查看藥單紀錄').click();await m.waitForTimeout(1800);assert.equal(await tx(m,'10月門診用藥').count(),0);assert.equal(await tx(m,'10/16 回診用藥整理').count(),0);});
 await home(m);await step('13 林秀英聊天仍獨立','回到林秀英的聊天室，只看見宜芳與美玲的相簿交接。',m,async()=>{await m.mouse.click(420,926);await tx(m,'林秀英的家屬').click();await tx(m,'謝謝美玲，媽媽喜歡一邊聽老歌一邊看照片。我下班會把相簿帶回去，有需要確認的事情再傳訊息給我。').waitFor();assert.equal(await tx(m,message).count(),0);assert.equal(await tx(m,reply).count(),0);});
 const g=await login(old.actors[2],'yijun-leave');await tx(g,'陳建國').waitFor();
 const patientRef=db.doc('patients/'+old.patientId),before=(await patientRef.get()).data();assert.ok(before.caregivers.includes(old.actors[2].uid));assert.ok(before.caregivers.includes(s.actors[0].uid));
 const reg=(await db.doc('_showcase_groups/'+old.id).get()).data();assert.equal(reg.synthetic,true);
 const preserve=[...reg.documentPaths,...reg.postvisitStage.documentPaths].filter(p=>p!=='patients/'+old.patientId),docs=await db.getAll(...preserve.map(p=>db.doc(p)));
 fs.writeFileSync(path.join(c.out,'before-leave.json'),JSON.stringify({patientId:old.patientId,caregivers:before.caregivers,documents:docs.map(d=>({path:d.ref.path,data:d.data()})),capturedAt:new Date().toISOString()},null,2));
 await step('14 怡君確認解除本人關聯','接班完成後，原照護員確認退出；提示說明共享資料保留。',g,async()=>{await g.mouse.click(432,40);await tx(g,'解除連結').click();await tx(g,'解除本人照護關聯').waitFor();await tx(g,'陳建國').waitFor();});
 await step('15 解除後無照護對象','只移除怡君本人，並清除目前長者；不會刪除帳號或歷史紀錄。',g,async()=>{await tx(g,'確認解除').click();await g.waitForURL('**/care-target/select',{timeout:60000});assert.equal(await tx(g,'陳建國').count(),0);});
 const after=(await patientRef.get()).data();assert.deepEqual(after.families,before.families);assert.deepEqual(after.caregivers,before.caregivers.filter(x=>x!==old.actors[2].uid));for(const d of docs)assert.deepEqual((await d.ref.get()).data(),d.data(),d.ref.path);
 await step('16 美玲仍可繼續照護','另一位照護員的權限與歷史資料不受影響，仍可讀取建國伯伯手冊。',m,async()=>{await switchTo(m,'陳建國');await m.mouse.click(432,40);await tx(m,'看護手冊').click();await m.getByText('10/16 回診後已核對藥袋',{exact:false}).filter({visible:true}).waitFor();});
 fs.writeFileSync(path.join(c.out,'leave-preservation.json'),JSON.stringify({preservedDocuments:docs.length,onlyYijunRemoved:true,familiesUnchanged:true,meilingRetained:true,checkedAt:new Date().toISOString()},null,2));
 }catch(e){errors.push(e.message);if(current){await current.screenshot({path:path.join(c.out,'switch-error.png')}).catch(()=>{});fs.writeFileSync(path.join(c.out,'switch-error-body.txt'),await current.locator('body').innerText());}throw e;}finally{for(const a of actors){await a.ctx.close();await a.p.video().saveAs(path.join(c.out,a.key+'.webm'));}await b.close();save();}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
