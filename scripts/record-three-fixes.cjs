const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18298')throw Error('Local emulator required');
const admin=require('../functions/node_modules/firebase-admin');
const app=admin.initializeApp({projectId:'demo-care-walkthrough'}),db=app.firestore();
const out=path.resolve('output/playwright/three-fixes-'+Date.now());fs.mkdirSync(out,{recursive:true});
const results=[],errors=[],warnings=[];let browser;
const tx=(p,s)=>p.getByText(s,{exact:true}).filter({visible:true}).last();
async function record(key,role,fn){
 const c=await browser.newContext({viewport:{width:390,height:844},recordVideo:{dir:path.join(out,'raw'),size:{width:390,height:844}},permissions:['clipboard-read','clipboard-write']});
 await c.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 const p=await c.newPage();p.setDefaultTimeout(20000);
 p.on('dialog',async d=>{await p.waitForTimeout(750);await d.accept();});
 p.on('pageerror',e=>errors.push({key,message:e.message}));
 p.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push({key,type:m.type(),message:m.text()});});
 p.on('console',m=>{if(m.text().startsWith('create patient error:'))console.log('CREATE_DIAGNOSTIC',m.text());});
 p.on('response',r=>{if(r.url().endsWith('/createCareTarget'))console.log('CREATE_HTTP',r.status());});
 async function check(label,fn){
  try{await fn();await p.waitForTimeout(1400);results.push({key,label,passed:true});}
  catch(e){results.push({key,label,passed:false,error:e.message});throw e;}
  finally{await p.screenshot({path:path.join(out,`${results.length}-${key}.png`)});console.log(label,results.at(-1).passed);}
 }
 try{
  await p.goto('http://localhost:8086',{timeout:120000});
  await p.getByPlaceholder('請輸入 Email').fill(`${role}.fixes@care.example`);
  await p.getByPlaceholder('請輸入密碼',{exact:true}).fill('LocalCare2026!');
  await tx(p,'立即登入').click();await p.waitForURL(`**/${role}`,{timeout:45000});
  await fn(p,check,c);
 }finally{await c.unrouteAll({behavior:'ignoreErrors'});await c.close();await p.video().saveAs(path.join(out,key+'.webm'));}
}
(async()=>{
 browser=await pw.chromium.launch({headless:true});
 try{
  await record('social','family',async(p,check)=>{
   for(const width of [320,390]){
    await check(`社群 ${width}px 正常點擊發布`,async()=>{
     await p.setViewportSize({width,height:844});
     await p.goto('http://localhost:8086/family/community');
     await p.getByRole('button',{name:'發表文章',exact:true}).click();
     await tx(p,'照護技巧').click();
     await p.getByPlaceholder('輸入標題...').fill(`交接資料放在同一處更方便 ${width}`);
     await p.getByPlaceholder('分享你的照護經驗、用品推薦或心得...').fill('回診前先把資料夾和交接記事整理好，家人來接手時就能一起確認。');
     await p.waitForTimeout(1200);
     await tx(p,'發布').click(); // ordinary center click; no force or JS bypass
     await p.waitForURL('**/family/community');
     await tx(p,`交接資料放在同一處更方便 ${width}`).waitFor();
    });
   }
  });
  await record('retry','family',async(p,check,c)=>{
   let originalId,serverResult,intercepted=false;
   const before=(await db.collection('patients').where('families','array-contains','three-fixes-family').get()).size;
   await c.route('**/createCareTarget',async r=>{
    if(r.request().method()!=='POST')return r.continue();
    if(intercepted)return r.continue();
    intercepted=true;
    originalId=r.request().postDataJSON().data.requestId;
    const response=await r.fetch({timeout:90000});assert.equal(response.status(),200);serverResult=await response.json();
    await r.fulfill({status:504,contentType:'application/json',body:JSON.stringify({error:{status:'DEADLINE_EXCEEDED',message:'Simulated lost response after commit'}})});
    await c.unroute('**/createCareTarget');
   });
   await check('建立成功但回應遺失，顯示確認原結果',async()=>{
    await p.goto('http://localhost:8086/care-target/create');
    const inputs=p.locator('input');await inputs.first().fill('陳淑惠');
    await p.locator('textarea').fill('下午由家人陪同散步，出門前確認隨身物品。');
    await tx(p,'確認建立').click();
    await tx(p,'確認原建立結果').waitFor({timeout:90000});
    await p.getByText('尚未確認建立結果，請稍後按',{exact:false}).waitFor({timeout:90000});
    assert(serverResult.result.patientId);
   });
   await check('重新整理保留原請求，重試只取回一筆長者',async()=>{
    await p.reload();await tx(p,'確認原建立結果').waitFor();
    assert.equal(await p.locator('input').first().inputValue(),'陳淑惠');
    const req=p.waitForRequest(r=>r.url().endsWith('/createCareTarget')&&r.method()==='POST');
    await tx(p,'確認原建立結果').click();
    assert.equal((await req).postDataJSON().data.requestId,originalId);
    await p.waitForURL('**/family',{timeout:90000});
    await tx(p,'陳淑惠').waitFor();
    const docs=await db.collection('patients').where('families','array-contains','three-fixes-family').get();
    assert.equal(docs.size,before+1);
   });
  });
  await record('charts','caregiver',async(p,check)=>{
   await tx(p,'每日健康回報').click();await tx(p,'歷史趨勢').click();
   for(const [label,points] of [['體溫',3],['心跳',3],['血壓',6],['血糖',3]]){
    await check(`${label}圖表資料與 Web 事件警告`,async()=>{
     await tx(p,label).click();await tx(p,label+'趨勢').waitFor();
     await p.locator('svg[aria-label="健康紀錄趨勢"]').waitFor();
     assert.equal(await p.locator('svg[aria-label="健康紀錄趨勢"] circle').count(),points);
     assert(!warnings.some(w=>w.key==='charts'&&/Unknown event handler/.test(w.message)));
    });
   }
  });
 }finally{
  await browser.close();await app.delete();
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({scope:'Local emulators; synthetic fixtures; actual browser recording; response loss injected after actual server commit',results,errors,warnings},null,2));
  console.log('OUTPUT',out);
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
