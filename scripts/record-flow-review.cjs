// Local UI recording harness: no production network or credentials.
const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline');
const assert=require('node:assert/strict');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18298'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:19099')throw Error('Dedicated local emulators required');
const admin=require('../functions/node_modules/firebase-admin');
const app=admin.initializeApp({projectId:'demo-care-walkthrough',storageBucket:'demo-care-walkthrough.appspot.com'});
const db=app.firestore();
const out=path.resolve(__dirname,'../output/playwright/flow-review-20261020');
fs.mkdirSync(out,{recursive:true});
const actors={},steps=[],errors=[],blocked=[];
const base='http://localhost:8086';
const password='LocalCare2026!';
let browser;
const text=(p,s)=>p.getByText(s,{exact:true}).filter({visible:true}).last();
const state=p=>p.locator('body').innerText();
function save(){fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({environment:'Local emulators, synthetic accounts, real browser UI recording; not iPhone or production',steps,errors,blocked},null,2));}
async function actor(name){
 const context=await browser.newContext({viewport:{width:480,height:960},timezoneId:'Asia/Taipei',recordVideo:{dir:path.join(out,'raw'),size:{width:480,height:960}},permissions:['clipboard-read','clipboard-write']});
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(['localhost','127.0.0.1'].includes(u.hostname)||['blob:','data:'].includes(u.protocol))return r.continue();blocked.push(u.origin);return r.abort();});
 const page=await context.newPage();page.setDefaultTimeout(18000);
 actors[name]={page,context,start:Date.now()};
 page.on('pageerror',e=>errors.push({actor:name,error:e.message}));
 page.on('dialog',async d=>{console.log('DIALOG',d.message());await d.accept();});
 await page.goto(base,{timeout:90000});return page;
}
async function step(name,key,fn){
 const a=actors[key],entry={name,actor:key,start:(Date.now()-a.start)/1000};steps.push(entry);save();
 try{await fn(a.page);await a.page.waitForTimeout(1400);entry.passed=true;}
 catch(e){entry.passed=false;entry.error=e.message;throw e;}
 finally{entry.end=(Date.now()-a.start)/1000;await a.page.screenshot({path:path.join(out,`${String(steps.length).padStart(2,'0')}.png`)});save();}
}
async function finish(){for(const [name,a]of Object.entries(actors)){await a.context.close();await a.page.video().saveAs(path.join(out,name+'.webm'));}save();await browser.close();await app.delete();console.log('FINISHED',out);}
(async()=>{browser=await pw.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});console.log('READY');const lines=readline.createInterface({input:process.stdin,terminal:false});for await(const line of lines){try{const {code}=JSON.parse(line);const result=await eval('(async()=>{'+code+'\n})()');console.log('RESULT',JSON.stringify(result??'ok'));}catch(e){console.log('ERROR',e.message);}}})().catch(e=>{console.error(e);process.exitCode=1;});
