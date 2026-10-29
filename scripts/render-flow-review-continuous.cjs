const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const out=path.resolve(__dirname,'../output/playwright/flow-review-20261020-short-retry');
function run(exe,args){const r=spawnSync(exe,args,{cwd:out,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);return r.stdout;}
const ff='C:/ffmpeg/bin/ffmpeg.exe',probe='C:/ffmpeg/bin/ffprobe.exe';
const duration=f=>Number(run(probe,['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',f]).trim());
fs.writeFileSync(path.join(out,'continuous-footer.txt'),'本機模擬器 · 合成資料 · 真實瀏覽器連續錄影\n兩個角色依序播放，並非同步畫面；無旁白');
let offset=0;const chapters=[];
for(const [key,label] of [['family','家屬：陳雅婷｜連續操作原始順序'],['caregiver','照護員：林怡君｜連續操作原始順序']]){
 fs.writeFileSync(path.join(out,key+'-continuous-title.txt'),label);
 run(ff,['-hide_banner','-loglevel','error','-nostdin','-y','-i',key+'.webm','-vf',`fps=25,scale=432:864,pad=720:1080:144:118:color=0x101c31,drawtext=fontfile='C\\:/Windows/Fonts/msjh.ttc':textfile=${key}-continuous-title.txt:fontsize=25:fontcolor=white:x=24:y=35,drawtext=fontfile='C\\:/Windows/Fonts/msjh.ttc':textfile=continuous-footer.txt:fontsize=18:fontcolor=0xbecce0:x=24:y=1002:line_spacing=8`,'-an','-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p',key+'-continuous.mp4']);
 const seconds=duration(key+'-continuous.mp4');chapters.push({role:key,title:label,start:offset,duration:seconds});offset+=seconds;
}
fs.writeFileSync(path.join(out,'continuous-concat.txt'),"file 'family-continuous.mp4'\nfile 'caregiver-continuous.mp4'\n");
run(ff,['-hide_banner','-loglevel','error','-nostdin','-y','-f','concat','-safe','0','-i','continuous-concat.txt','-c','copy','-movflags','+faststart','flow-review-continuous.mp4']);
fs.writeFileSync(path.join(out,'continuous-chapters.json'),JSON.stringify(chapters,null,2));
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>照護流程實測錄影</title><style>body{background:#101c31;color:white;font:16px system-ui;padding:24px;max-width:960px;margin:auto}p{line-height:1.8}video{width:100%;max-height:80vh}button{padding:12px;margin:6px;background:#294865;color:white;border:0;border-radius:8px}a{color:#a7dbff}</style><h1>照護流程實測錄影</h1><p>本機合成帳號、真實瀏覽器操作。家屬與照護員原始錄影依序播放，無旁白，不是 iPhone 或正式環境驗收。測試腳本較快，細節可暫停或用播放器調慢。</p><video id="v" src="flow-review-continuous.mp4" controls playsinline></video><div>${chapters.map(c=>`<button onclick="v.currentTime=${c.start};v.play()">${c.title}</button>`).join('')}</div><p>18 項連續流程重測通過，但社群發布按鈕遮擋、建立長者逾時的處理仍待修正。早期逐步剪輯片段時間偏移，請以本頁連續版為準。</p><p><a href="REPORT.md">測試報告</a> · <a href="results.json">測試結果</a> · <a href="flow-review-continuous.mp4" download>下載影片</a></p>`);
console.log(JSON.stringify({chapters,duration:duration('flow-review-continuous.mp4'),bytes:fs.statSync(path.join(out,'flow-review-continuous.mp4')).size}));
