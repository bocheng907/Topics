const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const out=path.resolve(__dirname,'../output/playwright/care-shift'),first=JSON.parse(fs.readFileSync(path.join(out,'recording.json'),'utf8')),second=JSON.parse(fs.readFileSync(path.join(out,'switch-recording.json'),'utf8'));
const r={chapters:[...first.chapters,...second.chapters],errors:[...first.errors,...second.errors]};
if(r.chapters.length!==16||r.chapters.some(c=>!c.passed)||r.errors.length)throw Error('All sixteen recorded chapters must pass');
const ffmpeg='C:/ffmpeg/bin/ffmpeg.exe',ffprobe='C:/ffmpeg/bin/ffprobe.exe';
function run(bin,args){const p=spawnSync(bin,args,{cwd:out,encoding:'utf8'});if(p.status!==0)throw Error(p.stderr||p.stdout);return p.stdout;}
const duration=file=>Number(run(ffprobe,['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file]).trim());
const wrap=(s,n)=>Array.from(s).reduce((a,c,i)=>{if(i%n===0)a.push('');a[a.length-1]+=c;return a;},[]).join('\n');
const chapters=r.chapters.map((ch,i)=>({...ch,id:String(i+1).padStart(2,'0'),audioPath:path.join(out,`voice-${i+1}.wav`),narration:ch.name.replace(/^\d+ /,'')+'。'+ch.description}));
for(const ch of chapters){fs.writeFileSync(path.join(out,`title-${ch.id}.txt`),ch.name);fs.writeFileSync(path.join(out,`caption-${ch.id}.txt`),wrap(ch.description,28));}
fs.writeFileSync(path.join(out,'narration.json'),JSON.stringify(chapters,null,2));
run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'showcase-narrate.ps1'),'-ManifestPath',path.join(out,'narration.json')]);
let seconds=0;const timeline=[];
for(const ch of chapters){const raw=ch.end-ch.start,len=Math.max(raw+2,duration(ch.audioPath)+1.5,9);const filter=`fps=25,pad=720:1200:120:110:color=0x101c31,drawtext=fontfile='C\\:/Windows/Fonts/msjh.ttc':textfile=title-${ch.id}.txt:fontsize=25:fontcolor=white:x=(w-text_w)/2:y=38,drawtext=fontfile='C\\:/Windows/Fonts/msjh.ttc':textfile=caption-${ch.id}.txt:fontsize=21:line_spacing=8:fontcolor=0xd4e3f7:x=(w-text_w)/2:y=1090,tpad=stop_mode=clone:stop_duration=${len-raw}`;
run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-y','-ss',String(ch.start),'-t',String(raw),'-i',ch.actor+'.webm','-i',ch.audioPath,'-vf',filter,'-af','apad','-t',String(len),'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-ar','48000',`chapter-${ch.id}.mp4`]);timeline.push({name:ch.name,seconds});seconds+=duration(`chapter-${ch.id}.mp4`);console.log('RENDER',ch.name);}
fs.writeFileSync(path.join(out,'concat.txt'),chapters.map(ch=>`file 'chapter-${ch.id}.mp4'`).join('\n'));
run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-y','-f','concat','-safe','0','-i','concat.txt','-c','copy','-movflags','+faststart','care-shift.mp4']);
fs.writeFileSync(path.join(out,'chapters.json'),JSON.stringify(timeline,null,2));
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>美玲的第一天：雙長者接班</title><style>body{font:17px system-ui;background:#101c31;color:white;margin:24px}main{max-width:1000px;margin:auto}video{width:100%;max-height:78vh}button{display:block;background:#233650;color:white;border:0;border-radius:8px;padding:12px;margin:8px 0;cursor:pointer}p{line-height:1.7}a{color:#a6dfff}</style><main><h1>美玲的第一天：雙長者接班</h1><p>閱讀手冊 → 健康回報 → 雙長者切換 → 家屬交接 → 原照護員退出與資料保留。<br>專用合成展示群組的實際瀏覽器操作，附中文合成旁白；非實際醫療事件。</p><video id="v" controls playsinline src="care-shift.mp4"></video>${timeline.map(ch=>`<button onclick="v.currentTime=${ch.seconds};v.play()">${Math.floor(ch.seconds/60)}:${String(Math.floor(ch.seconds%60)).padStart(2,'0')}　${ch.name}</button>`).join('')}<p><a href="README.md">驗證與限制</a></p></main>`);
// Render the final video itself for visual QA, not just original screenshots.
run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-y','-i','care-shift.mp4','-vf','fps=1/14,scale=240:400,tile=4x4','-frames:v','1','video-contact-sheet.jpg']);
console.log(JSON.stringify({file:path.join(out,'care-shift.mp4'),duration:seconds,chapters:16}));
