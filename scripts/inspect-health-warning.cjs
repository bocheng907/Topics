const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await pw.chromium.launch({headless:true});try{
 const context=await browser.newContext({viewport:{width:480,height:960}});
 await context.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 const p=await context.newPage();p.on('console',m=>{if(['warning','error'].includes(m.type()))console.log(m.type(),m.text());});
 await p.goto('http://localhost:8086');await p.getByPlaceholder('請輸入 Email').fill('yijun@care.example');await p.getByPlaceholder('請輸入密碼',{exact:true}).fill('LocalCare2026!');await p.getByText('立即登入',{exact:true}).click();await p.getByText('陳建國',{exact:true}).first().waitFor();await p.getByText('每日健康回報',{exact:true}).click();await p.getByText('歷史趨勢',{exact:true}).click();await p.getByText('體溫趨勢',{exact:true}).waitFor();await p.waitForTimeout(2000);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
