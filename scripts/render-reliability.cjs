const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const out=path.resolve(__dirname,'../output/playwright/reliability');
const recorded=JSON.parse(fs.readFileSync(path.join(out,'results.json'),'utf8'));
if(recorded.total!==11||recorded.chapters?.length!==9)throw Error('All eleven browser checks and nine checkpoints required');
const ffmpeg='C:/ffmpeg/bin/ffmpeg.exe',ffprobe='C:/ffmpeg/bin/ffprobe.exe';
function run(bin,args){const r=spawnSync(bin,args,{cwd:out,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||r.stdout);return r.stdout;}
const duration=file=>Number(run(ffprobe,['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file]).trim());
const descriptions=[
 ['兩位家屬同時編輯','雅婷先儲存，志明再送出時被提醒版本衝突。志明的草稿仍保留，沒有覆蓋最新版。'],
 ['重新載入最新版','志明確認放棄草稿後，重新載入雅婷發布的內容，再自行整合需要的修改。'],
 ['家屬查看接班確認','照護員按下已閱讀並接班後，家屬看得到這一版的確認，以及帳號識別碼和伺服器時間。'],
 ['照護員完成接班','照護員確認綁定目前版本。同一版本再次送出不會改寫原本的確認時間。'],
 ['更新手冊需要重新確認','家屬再次發布新版，舊版確認不算完成。照護員必須閱讀新內容後重新確認。'],
 ['斷網保留健康紀錄','斷網時不顯示儲存成功。原本輸入的體溫和心跳保留，提示恢復網路後重試。'],
 ['連線後重試不重複','恢復網路後連按儲存，資料庫仍只有一筆健康紀錄。這一項也有資料庫斷言驗證。'],
 ['斷網保留手冊草稿','手冊儲存也會檢查網路。沒有確認成功時保留草稿，不會誤報已發布。'],
 ['恢復網路完成發布','重試成功後發布新版。草稿只保留在開著的頁面，關閉或重新載入應用程式不會保留。'],
];
const wrap=(s,n)=>Array.from(s).reduce((a,c,i)=>{if(i%n===0)a.push('');a[a.length-1]+=c;return a;},[]).join('\n');
const chapters=recorded.chapters.map((c,i)=>({...c,id:String(i+1).padStart(2,'0'),title:descriptions[i][0],description:descriptions[i][1],audioPath:path.join(out,`voice-${i}.wav`),narration:descriptions[i].join('。')}));
fs.writeFileSync(path.join(out,'narration.json'),JSON.stringify(chapters,null,2));
run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'showcase-narrate.ps1'),'-ManifestPath',path.join(out,'narration.json')]);
let cursor=0;const timeline=[];
for(const c of chapters){
 fs.writeFileSync(path.join(out,`title-${c.id}.txt`),c.title);
 fs.writeFileSync(path.join(out,`caption-${c.id}.txt`),wrap(c.description,27));
 fs.writeFileSync(path.join(out,'source-label.txt'),'隔離操作錄影＋實測截圖｜合成情境與旁白');
 // End inside the 1.2s checkpoint hold, before subsequent actions start.
 const stop=Math.min(c.seconds-0.5,duration(c.file)-0.05),start=Math.max(0,stop-3),raw=stop-start;
 const len=Math.max(raw+2,duration(c.audioPath)+1,9);
 const filter=`[0:v]fps=25,setpts=PTS-STARTPTS,setsar=1[v];[1:v]fps=25,trim=duration=${len-raw},setpts=PTS-STARTPTS,setsar=1[s];[v][s]concat=n=2:v=1:a=0,pad=720:1200:120:95:color=0x101c31,drawtext=fontfile='C\\:/Windows/Fonts/msjh.ttc':textfile=title-${c.id}.txt:fontsize=26:fontcolor=white:x=(w-text_w)/2:y=26,drawtext=fontfile='C\\:/Windows/Fonts/msjh.ttc':textfile=source-label.txt:fontsize=16:fontcolor=0x9ab0cb:x=(w-text_w)/2:y=65,drawtext=fontfile='C\\:/Windows/Fonts/msjh.ttc':textfile=caption-${c.id}.txt:fontsize=21:line_spacing=6:fontcolor=0xd4e3f7:x=(w-text_w)/2:y=1078[out]`;
 run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-y','-ss',String(start),'-t',String(raw),'-i',c.file,'-loop','1','-framerate','25','-i',c.label+'.png','-i',c.audioPath,'-filter_complex',filter,'-map','[out]','-map','2:a','-af','apad','-t',String(len),'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-b:a','128k',`chapter-${c.id}.mp4`]);
 timeline.push({title:c.title,seconds:cursor,source:c.file,sourceStart:start,sourceStop:stop});cursor+=duration(`chapter-${c.id}.mp4`);console.log('Rendered '+c.title);
}
fs.writeFileSync(path.join(out,'concat.txt'),chapters.map(c=>`file 'chapter-${c.id}.mp4'`).join('\n'));
run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-y','-f','concat','-safe','0','-i','concat.txt','-c','copy','-movflags','+faststart','handover-reliability.mp4']);
fs.writeFileSync(path.join(out,'timeline.json'),JSON.stringify(timeline,null,2));
// Inspect frames from the final encoded video, near each chapter's final hold.
for(let i=0;i<timeline.length;i++){
 const end=i+1<timeline.length?timeline[i+1].seconds:cursor;
 run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-y','-ss',String(end-1),'-i','handover-reliability.mp4','-frames:v','1','-vf','scale=240:400',`qa-${String(i+1).padStart(2,'0')}.png`]);
}
run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-y','-framerate','1','-i','qa-%02d.png','-vf','tile=3x3','-frames:v','1','contact-sheet.jpg']);
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>交班確認與斷網重試</title><style>body{font:17px system-ui;background:#101c31;color:white;margin:24px}main{max-width:1000px;margin:auto}video{width:100%;max-height:78vh}button{display:block;background:#263c5b;color:white;border:0;border-radius:8px;padding:12px;margin:8px 0;cursor:pointer}p{line-height:1.7}a{color:#a6dfff}</style><main><h1>交班確認與斷網重試</h1><p>隔離 Emulator 的三角色瀏覽器實際操作剪輯，部分畫面停格延長，附中文合成旁白。非真實照護事件；未部署、未改正式資料，亦不代表手機驗收。</p><video id="v" controls playsinline src="handover-reliability.mp4"></video>${timeline.map(c=>`<button onclick="v.currentTime=${c.seconds};v.play()">${Math.floor(c.seconds/60)}:${String(Math.floor(c.seconds%60)).padStart(2,'0')}　${c.title}</button>`).join('')}<p><a href="README.md">測試範圍及限制</a></p></main>`);
console.log(JSON.stringify({file:path.join(out,'handover-reliability.mp4'),seconds:cursor,chapters:timeline.length}));
