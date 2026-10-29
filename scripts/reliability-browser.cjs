const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const admin=require('../functions/node_modules/firebase-admin');
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18298'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:19099')throw Error('Local emulators only');
const project='demo-care-walkthrough',base='http://localhost:8086';
const app=admin.initializeApp({projectId:project},'reliability-browser');
const db=app.firestore(),out=path.resolve(__dirname,process.env.RELIABILITY_OUTPUT||'../output/playwright/reliability');
fs.mkdirSync(out,{recursive:true});
const results=[],dialogs=[],contexts=[],chapters=[];
const text=(p,s)=>p.getByText(s,{exact:true}).filter({visible:true}).last();
async function waitFor(fn,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,150));}throw Error('Timed out waiting for database condition');}
(async()=>{
 const pid='reliability-'+randomUUID();
 const actors=[];
 for(const [role,name]of [['family','陳雅婷'],['family','陳志明'],['caregiver','張美玲']]){
  const uid=randomUUID(),email=`${uid}@example.invalid`,password='LocalOnly-'+randomUUID();
  await app.auth().createUser({uid,email,password,displayName:name});
  await db.doc(`users/${uid}`).set({uid,email,role,name,displayName:name,activePatientId:pid,accountStatus:'active',privacyConsentVersion:'2026-09-22.v2',privacyConsentAt:admin.firestore.Timestamp.now()});
  actors.push({uid,email,password,role,name});
 }
 await db.doc(`patients/${pid}`).set({name:'陳建國',patientsId:'local-reliability',families:actors.slice(0,2).map(x=>x.uid),caregivers:[actors[2].uid],primaryFamilyUid:actors[0].uid,createdBy:actors[0].uid,createdAt:admin.firestore.Timestamp.now()});
 const main=db.doc(`patients/${pid}/care_handbook/main`);
 await main.set({patientId:pid,updatedBy:actors[0].uid,updatedAt:admin.firestore.Timestamp.now(),dailyRoutine:'早餐後散步，下午整理回診資料。',medicationNotes:'依照藥袋內容核對，不自行調整。',dietNotes:'午餐準備軟飯。',mobilityNotes:'外出使用助行器。',hygieneNotes:'',sleepNotes:'',communicationNotes:'',emergencyNotes:'',otherNotes:''});
 const browser=await pw.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 async function checkpoint(p,label){await p.waitForTimeout(1200);await p.screenshot({path:path.join(out,label+'.png')});results.push(label);
   const actor=actors.find(a=>a.page===p);chapters.push({label,actor:actor.name,file:actor.role+'-'+actors.indexOf(actor)+'.webm',seconds:(Date.now()-actor.videoStart)/1000});
   console.log('PASS '+label);}
 async function menu(p,label){await p.getByRole('button',{name:'開啟選單',exact:true}).click();await text(p,label).click();}
 try{
  for(const a of actors){
   const context=await browser.newContext({viewport:{width:480,height:960},timezoneId:'Asia/Taipei',recordVideo:{dir:path.join(out,'raw'),size:{width:480,height:960}}});
   contexts.push(context);
   await context.route('**/*',route=>{const u=new URL(route.request().url());return ['localhost','127.0.0.1'].includes(u.hostname)||['data:','blob:'].includes(u.protocol)?route.continue():route.abort();});
   const page=await context.newPage();a.page=page;a.context=context;a.videoStart=Date.now();
   page.on('dialog',async d=>{dialogs.push({actor:a.name,message:d.message()});await (d.message().includes('通知看護')||d.message().includes('前往聊天室')?d.dismiss():d.accept());});
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.getByPlaceholder('請輸入 Email').fill(a.email);
   await page.getByPlaceholder('請輸入密碼').fill(a.password);
   await text(page,'立即登入').click();
   await page.waitForURL(`**/${a.role}`,{timeout:60000});
   await menu(page,'看護手冊');
   await text(page,a.role==='family'?'儲存手冊':'早餐後散步，下午整理回診資料。').waitFor({timeout:30000});
  }
  const [f,b,c]=actors;
  await f.page.locator('textarea').first().fill('早餐後散步十分鐘；回診資料已放在藍色資料夾。');
  await b.page.locator('textarea').first().fill('下午由志明陪同整理回診資料。');
  await text(f.page,'儲存手冊').click();
  await waitFor(async()=>(await main.get()).data().revision);
  const r1=(await main.get()).data().revision;
  await text(b.page,'儲存手冊').click();
  await text(b.page,'重新載入最新版').waitFor();
  assert.equal(await b.page.locator('textarea').first().inputValue(),'下午由志明陪同整理回診資料。');
  assert.equal((await main.get()).data().dailyRoutine,'早餐後散步十分鐘；回診資料已放在藍色資料夾。');
  await text(b.page,'重新載入最新版').scrollIntoViewIfNeeded();
  await checkpoint(b.page,'01-conflict-preserves-draft');
  await text(b.page,'重新載入最新版').click();
  await waitFor(async()=>await b.page.locator('textarea').first().inputValue()==='早餐後散步十分鐘；回診資料已放在藍色資料夾。');
  await checkpoint(b.page,'02-reload-latest');
  await text(c.page,'已閱讀並接班').click();
  const ack=main.collection('acknowledgments').doc(c.uid);
  await waitFor(async()=>(await ack.get()).data()?.revision===r1);
  await text(f.page,'已確認此版本').waitFor();
  await text(f.page,'已確認此版本').scrollIntoViewIfNeeded();
  await checkpoint(f.page,'03-family-sees-acknowledgment');
  await checkpoint(c.page,'04-caregiver-acknowledged');
  await f.page.locator('textarea').nth(2).fill('晚餐改為清蒸魚與軟飯，餐後整理餐桌。');
  await text(f.page,'儲存手冊').click();
  await waitFor(async()=>(await main.get()).data().revision!==r1);
  await text(c.page,'此版本尚待照護員閱讀並確認接班。').waitFor();
  await checkpoint(c.page,'05-new-version-needs-new-ack');
  await text(c.page,'已閱讀並接班').click();
  await waitFor(async()=>(await ack.get()).data()?.revision===(await main.get()).data().revision);
  results.push('06-reacknowledge-new-version');
  // Offline health form submission, then reconnect and double-click retry.
  await text(c.page,'返回').click(); await c.page.waitForURL('**/caregiver');
  await text(c.page,'每日健康回報').click();
  await c.page.getByPlaceholder('36.5').fill('NaN');
  const invalidBefore=dialogs.length;await text(c.page,'儲存').click();
  await waitFor(()=>dialogs.length>invalidBefore);
  assert.equal((await db.collection('health_records').where('patientId','==',pid).get()).size,0);
  results.push('07a-invalid-number-blocked');
  await c.page.getByPlaceholder('36.5').fill('36.7');
  await c.page.getByPlaceholder('80').fill('78');
  await c.context.setOffline(true);await text(c.page,'儲存').click();
  await text(c.page,'尚未確認儲存成功。內容已保留，請恢復網路後重試；同一筆重試不會重複建立。請勿關閉此頁或 App。').waitFor({timeout:30000});
  assert.equal(await c.page.getByPlaceholder('36.5').inputValue(),'36.7');
  assert.equal((await db.collection('health_records').where('patientId','==',pid).get()).size,0);
  await checkpoint(c.page,'07-offline-keeps-entry');
  await c.context.setOffline(false);
  await text(c.page,'儲存').dblclick();
  await waitFor(async()=>(await db.collection('health_records').where('patientId','==',pid).get()).size===1,30000);
  await new Promise(r=>setTimeout(r,1000));
  const health=await db.collection('health_records').where('patientId','==',pid).get();
  assert.equal(health.size,1);assert.equal(health.docs[0].data().temperature,36.7);
  assert.match(health.docs[0].id,/^[a-f0-9-]{36}$/);
  await checkpoint(c.page,'08-online-retry-only-one-record');
  // Offline family publish retains draft and uses the same revision on retry.
  await f.page.locator('textarea').nth(8).fill('交班時請再確認藍色資料夾放在門口。');
  const before=(await main.get()).data().revision;
  await f.context.setOffline(true);await text(f.page,'儲存手冊').click();
  await text(f.page,'尚未確認儲存成功。內容已保留，請恢復網路後重試；同一筆重試不會重複建立。請勿關閉此頁或 App。').waitFor({timeout:30000});
  await text(f.page,'尚未確認儲存成功。內容已保留，請恢復網路後重試；同一筆重試不會重複建立。請勿關閉此頁或 App。').scrollIntoViewIfNeeded();
  assert.equal((await main.get()).data().revision,before);
  await checkpoint(f.page,'09-offline-handbook-draft');
  await f.context.setOffline(false);await text(f.page,'儲存手冊').click();
  await waitFor(async()=>(await main.get()).data().revision!==before);
  assert.equal((await main.get()).data().otherNotes,'交班時請再確認藍色資料夾放在門口。');
  await checkpoint(f.page,'10-handbook-retry-success');
 }catch(e){
  for(let i=0;i<actors.length;i++)if(actors[i].page)await actors[i].page.screenshot({path:path.join(out,`failure-${i}.png`)}).catch(()=>{});
  throw e;
 }finally{
  for(let i=0;i<contexts.length;i++){const page=actors[i].page;await contexts[i].close();if(page?.video())await page.video().saveAs(path.join(out,actors[i].role+'-'+i+'.webm'));}
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({project,results,dialogs,chapters,total:results.length},null,2));
  await browser.close();await app.delete();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
