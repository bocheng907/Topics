const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const common=require('./showcase-common.cjs');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.join(common.root,'output/playwright/care-week');
const chapters=[];
async function main(){
 if(process.env.CONFIRM_SHOWCASE_PROJECT!=='smart-care-system-1a41e')throw Error('Explicit showcase target required');
 fs.mkdirSync(out,{recursive:true});const s=common.prepare();
 const browser=await pw.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 try{for(const a of s.actors){
  if(a.uid){console.log('EXISTS',a.key);continue;}
  const context=await browser.newContext({viewport:{width:480,height:960},timezoneId:'Asia/Taipei',recordVideo:{dir:path.join(out,'raw'),size:{width:480,height:960}}});
  const page=await context.newPage();let dialogError='';page.on('dialog',async d=>{dialogError=d.message();await d.accept();});page.setDefaultTimeout(25000);
  const start=Date.now();
  try{
   await page.goto('http://localhost:8083',{timeout:90000});
   await page.getByText('去註冊',{exact:false}).click();
   await page.getByText(a.role==='family'?'家屬':'看護',{exact:true}).click();
   await page.getByPlaceholder('例如：王小明／陳阿姨').fill(a.name);
   await page.getByPlaceholder('example@mail.com').fill(a.email);
   await page.getByPlaceholder('至少 8 碼，包含小寫英文字母與數字').fill(a.password);
   if(a.role==='family'){
    await page.getByPlaceholder('例如：0912345678').fill('0000000000');
    await page.getByPlaceholder('例如：0987654321').fill('0000000000');
   }
   await page.getByRole('checkbox').click();await page.waitForTimeout(1200);
   await page.getByText('完成並註冊',{exact:true}).click();
   await page.waitForURL(a.role==='family'?'**/care-target/create':'**/caregiver',{timeout:45000});
   const api=await common.identify(s,a);
   assert.equal((await api.db.doc('users/'+a.profileId).get()).data().privacyConsent.version,'2026-09-22.v2');
   await page.waitForTimeout(1800);await page.screenshot({path:path.join(out,`register-${a.key}.png`)});
   chapters.push({name:a.name+'建立帳號',actor:a.key,duration:(Date.now()-start)/1000,passed:true});
   console.log('PASS registration',a.key);
  }catch(e){await page.screenshot({path:path.join(out,`register-${a.key}-error.png`)}).catch(()=>{});console.log('UI_FAILURE',a.key,dialogError);throw e;}
  finally{await context.close();await page.video().saveAs(path.join(out,`register-${a.key}.webm`));fs.writeFileSync(path.join(out,'registration.json'),JSON.stringify(chapters,null,2));}
 }}finally{await browser.close();}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
