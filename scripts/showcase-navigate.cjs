const fs=require('node:fs'),path=require('node:path');const c=require('./showcase-common.cjs');const pw=require(process.env.PLAYWRIGHT_MODULE);
async function main(){const s=c.state(),out=path.join(c.root,'output/playwright/care-week');const b=await pw.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
try{for(const key of ['family','caregiver']){const a=s.actors.find(a=>a.key===key),ctx=await b.newContext({viewport:{width:480,height:960},timezoneId:'Asia/Taipei'});const p=await ctx.newPage();p.on('dialog',d=>d.accept());p.setDefaultTimeout(20000);await p.goto('http://localhost:8083');await p.getByPlaceholder('請輸入 Email').fill(a.email);await p.getByPlaceholder('請輸入密碼').fill(a.password);await p.getByText('立即登入',{exact:true}).click();await p.waitForURL(`**/${a.role}`,{timeout:45000});await p.waitForTimeout(3000);
const text=t=>p.getByText(t,{exact:true}).filter({visible:true}).last();
const inspect=async name=>{await p.waitForTimeout(3500);await p.screenshot({path:path.join(out,`nav-${key}-${name}.png`)});const t=await p.locator('body').innerText();fs.writeFileSync(path.join(out,`nav-${key}-${name}.txt`),t);console.log(key,name,p.url(),t.slice(0,3500));};
const home=async()=>{await p.goto('http://localhost:8083');await p.waitForURL(`**/${a.role}`);await p.waitForTimeout(3000);};
if(key==='family'){
 await text('藥單紀錄').click();await inspect('list');await text('10月門診用藥').click();await inspect('detail');await home();
 await text('查看圖表').click();await inspect('chart');await home();
 await p.mouse.click(180,926);await inspect('calendar');await text('16').click();await inspect('calendar-tomorrow');await home();
 await p.mouse.click(300,926);await inspect('notifications');await home();
 await p.mouse.click(420,926);await inspect('chats');await text('看護').click();await inspect('shared');
}else{
 await p.mouse.click(432,40);await text('記事本').click();await inspect('notes');await home();
 await p.mouse.click(432,40);await text('看護手冊').click();await inspect('handbook');
}await ctx.close();}}finally{await b.close();}}
main().catch(e=>{console.error(e.message);process.exit(1)});
