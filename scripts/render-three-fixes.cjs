const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const out=path.resolve(process.argv[2]||'');
if(!out.startsWith(path.resolve('output/playwright')+path.sep))throw Error('Expected recording directory');
const result=JSON.parse(fs.readFileSync(path.join(out,'results.json')));
if(result.results.length!==8||result.results.some(r=>!r.passed)||result.errors.length)throw Error('Recording did not pass');
const ff='C:/ffmpeg/bin/ffmpeg.exe',probe='C:/ffmpeg/bin/ffprobe.exe';
function run(exe,args){const r=spawnSync(exe,args,{cwd:out,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);return r.stdout;}
const duration=f=>Number(run(probe,['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',f]).trim());
const chapters=[];let start=0;
for(const[key,title,footer]of [
 ['social','社群發布｜320px 與 390px','一般點擊發布，未使用強制點擊'],
 ['retry','建立長者｜回應遺失與恢復','刻意模擬回應遺失；重新整理後取回原結果'],
 ['charts','健康圖表｜四種量測資料','體溫、心跳、血壓、血糖；Web 圖表驗證']]){
 fs.writeFileSync(path.join(out,key+'-title.txt'),title);
 fs.writeFileSync(path.join(out,key+'-footer.txt'),'本機模擬器 · 合成資料 · 真實瀏覽器錄影\n'+footer);
 run(ff,['-hide_banner','-loglevel','error','-nostdin','-y','-i',key+'.webm','-vf',`fps=25,pad=720:1080:165:118:color=0x101c31,drawtext=fontfile='C\\:/Windows/Fonts/msjh.ttc':textfile=${key}-title.txt:fontsize=27:fontcolor=white:x=24:y=35,drawtext=fontfile='C\\:/Windows/Fonts/msjh.ttc':textfile=${key}-footer.txt:fontsize=20:fontcolor=0xbecce0:x=24:y=992:line_spacing=8`,'-an','-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p',key+'.mp4']);
 const seconds=duration(key+'.mp4');chapters.push({key,title,start,duration:seconds});start+=seconds;
}
fs.writeFileSync(path.join(out,'concat.txt'),chapters.map(c=>`file '${c.key}.mp4'`).join('\n'));
run(ff,['-hide_banner','-loglevel','error','-nostdin','-y','-f','concat','-safe','0','-i','concat.txt','-c','copy','-movflags','+faststart','three-fixes.mp4']);
run(ff,['-v','error','-i','three-fixes.mp4','-f','null','-']);
run(ff,['-hide_banner','-loglevel','error','-y','-i','three-fixes.mp4','-vf',`fps=1/${Math.max(1,start/12)},scale=240:360,tile=4x3`,'-frames:v','1','contact-sheet.jpg']);
fs.writeFileSync(path.join(out,'chapters.json'),JSON.stringify(chapters,null,2));
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><meta charset="utf-8"><title>三項修正驗收</title><style>body{background:#101c31;color:white;font:18px system-ui;max-width:900px;margin:24px auto}video{width:100%;max-height:80vh}button{padding:12px;margin:8px}p{line-height:1.7}</style><h1>三項修正驗收錄影</h1><p>隔離模擬器、合成資料、連續真實瀏覽器操作。第二段刻意在後端建立完成後丟棄回應，驗證重試不重複建立。不是正式環境或 iPhone 實測，無旁白。</p><video id="v" src="three-fixes.mp4" controls></video>${chapters.map(c=>`<button onclick="v.currentTime=${c.start};v.play()">${c.title}</button>`).join('')}`);
console.log(JSON.stringify({out,duration:start,bytes:fs.statSync(path.join(out,'three-fixes.mp4')).size,chapters}));
