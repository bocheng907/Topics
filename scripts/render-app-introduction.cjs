// Presentation film using verified screenshots and continuous UI recordings.
// No production data access. Keep source recordings untouched.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'output/app-introduction-20261020');
fs.mkdirSync(out,{recursive:true});
const w='output/playwright/care-week/';
const r='output/playwright/flow-review-20261020-short-retry/';
const v='output/playwright/three-fixes-1792476562005/';
const scenes=[
 {title:'照護，不該只靠記憶',tag:'故事 × 專題介紹',points:'智慧照護 APP\n讓家屬與照護員，共享照護脈絡',narration:'當家人不在身邊，如何知道長輩今天的照護狀況？量測記錄在哪裡，回診要帶什麼，交班時又有哪些事情不能漏掉？智慧照護應用程式，嘗試把這些分散的資訊，整理成家屬與照護員都能理解的日常流程。'},
 {title:'從陳建國的日常開始',tag:'01 / 人物與情境',points:'陳建國｜接受照護的長者\n陳雅婷｜關心父親的家屬\n林怡君｜協助日常照護的照護員',narration:'故事裡，陳建國需要日常照護，女兒雅婷希望掌握父親的近況，照護員怡君負責記錄與交接。三個角色的需求不同，卻圍繞著同一位長者。以下以合成情境和實際介面，看看這套應用程式如何串起他們的一天。'},
 {title:'早晨，先掌握今日狀況',tag:'02 / 照護首頁',points:'今日用藥進度\n最近一次健康量測\n常用照護功能入口',image:w+'home-progress-fixed.png',narration:'早上，雅婷打開照護首頁，先查看今天的用藥進度，以及最近一次健康量測。資訊集中在同一個頁面，不必先翻找好幾段聊天訊息。這裡顯示的是已記錄的狀態，而不是持續監測的即時生理訊號。'},
 {title:'把用藥資訊整理清楚',tag:'03 / 藥單與紀錄',points:'查看藥品內容與服用安排\n保留回診提醒與藥單備註\n用藥仍以醫療專業指示為準',image:w+'chapter-03.png',narration:'接著，家屬可以打開藥單，查看藥品內容、服用安排與整張藥單的備註。例如回診時，要帶上原本的藥袋和居家量測紀錄。應用程式協助整理資訊，但不自行決定劑量，也不能取代醫師或藥師的用藥指示。'},
 {title:'量測之後，看見變化',tag:'04 / 健康紀錄與趨勢',points:'體溫、心跳、血壓、血糖\n依時間查看量測變化\n讓回顧與說明更有依據',video:v+'charts.webm',narration:'怡君完成量測後，把體溫、心跳、血壓和血糖登錄到系統。家屬可以依照時間範圍查看趨勢，不只看到一個數字，也能回顧最近的變化。圖表提供整理與溝通的依據，不會把量測數字直接當成醫療診斷。'},
 {title:'回診前，先把事情對齊',tag:'05 / 行事曆與安排',points:'看診時間與地點\n接送分工與隨身物品\n把約定放回照護情境中',image:w+'nav-family-calendar-tomorrow.png',narration:'到了回診前一天，雅婷先查看行事曆，確認看診時間、報到地點與需要攜帶的物品。接送分工可以再透過聊天確認。同一件事情，在行程和溝通紀錄裡相互呼應，讓準備工作不只停留在口頭約定。'},
 {title:'一則訊息，完成交接確認',tag:'06 / 家屬與照護員溝通',points:'照護員回報準備狀況\n家屬確認收到並回覆\n留下可以再次查閱的紀錄',image:r+'07.png',narration:'怡君傳訊息告訴雅婷，回診資料已放在玄關，也把注意事項補進交接記事。雅婷回覆收到，並說明抵達後會再確認。這樣的來回，讓資訊不只是送出，而是有了具體的確認，也能在需要時重新查閱。'},
 {title:'換人接手，也能接續照護',tag:'07 / 看護手冊與記事',points:'長期注意事項，放進手冊\n當次變化，補進交接記事\n確認閱讀版本，減少資訊落差',image:r+'08.png',narration:'日常習慣和長期注意事項，可以整理在看護手冊；這次回診的變化，則補在交接記事。接手的人能閱讀並確認手冊版本。系統協助保留交接脈絡，但重要或緊急事項，仍需要直接聯絡與確認，不能只依賴應用程式。'},
 {title:'把照護經驗，變成交流',tag:'08 / 照護社群',points:'分類分享照護經驗\n閱讀文章與留言交流\n分享前，避免透露個人健康隱私',video:v+'social.webm',narration:'除了同一個照護群組內的溝通，家屬也能在照護社群分享整理資料、交接安排或用品使用的經驗。文章可以分類，也能留言交流。分享之前，應避免透露長者的身分與健康隱私；社群內容也不能取代專業醫療建議。'},
 {title:'資料管理，也是照護的一部分',tag:'09 / 個人資料與帳號',points:'重新驗證後匯出個人資料\n帳號刪除設有緩衝流程\n資料範圍依身分與權限區分',image:r+'12.png',narration:'照護之外，使用者也需要掌握自己的資料。系統提供重新驗證後的個人資料匯出，以及帳號刪除與緩衝流程。匯出範圍依本人資料和可存取紀錄決定，不等於下載整個照護群組的全部內容。匯出後的檔案，也需要妥善保存。'},
 {title:'從功能，走向完整流程',tag:'10 / 專題設計特色',points:'多角色協作，而非單人記事本\n前端操作搭配後端權限檢查\n建立請求重試，避免重複資料',narration:'這個專題的重點，不只是把功能放進同一個應用程式，而是讓不同角色能接續完成照護流程。前端使用 Expo，後端結合 Firebase 的帳號、資料與函式服務。建立長者時也加入重試識別，遇到回應遺失，可以取回原結果，避免重複建立。'},
 {title:'讓每一次接手，都有依據',tag:'智慧照護 APP',points:'資訊有紀錄　交接有脈絡\n家屬與照護員，一起照顧日常\n暨南大學資管系・智慧醫療團隊',narration:'從早晨量測，到回診準備，再到家屬與照護員之間的確認，智慧照護應用程式希望讓每一次接手都有依據。讓資訊有紀錄，交接有脈絡。這支影片使用合成展示資料與實際介面，呈現專題的使用情境，不代表醫療效果或全部實機功能都已完成驗收。'},
];
const ff='C:/ffmpeg/bin/ffmpeg.exe',probe='C:/ffmpeg/bin/ffprobe.exe';
function run(exe,args){const p=spawnSync(exe,args,{cwd:out,encoding:'utf8',maxBuffer:8e6});if(p.status!==0)throw Error(p.stderr||p.stdout);return p.stdout;}
const dur=f=>Number(run(probe,['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',f]).trim());
const wrap=(s,n)=>Array.from(s).reduce((a,c,i)=>{if(i%n===0)a.push('');a[a.length-1]+=c;return a;},[]).join('\n');
for(const [i,s]of scenes.entries()){s.id=String(i+1).padStart(2,'0');s.audioPath=path.join(out,s.id+'.wav');}
fs.writeFileSync(path.join(out,'script.json'),JSON.stringify(scenes,null,2));
run('powershell.exe',['-NoProfile','-File',path.join(root,'scripts/showcase-narrate.ps1'),'-ManifestPath',path.join(out,'script.json')]);
const font="C\\:/Windows/Fonts/msjh.ttc";
fs.writeFileSync(path.join(out,'disclosure.txt'),'情境示範｜合成資料・實際介面・中文合成旁白');
let start=0;const chapters=[];
for(const s of scenes){
 const speechSpeed=1.4;
 const seconds=Math.max(15,dur(s.audioPath)/speechSpeed+1.5);
 for(const [k,t]of Object.entries({title:s.title,tag:s.tag,points:s.points,caption:wrap(s.narration,46)}))fs.writeFileSync(path.join(out,`${s.id}-${k}.txt`),t);
 const args=['-hide_banner','-loglevel','error','-nostdin','-y','-f','lavfi','-i',`color=c=0x101e30:s=1280x720:r=25:d=${seconds}`];
 const hasMedia=!!(s.image||s.video);
 if(s.image)args.push('-loop','1','-i',path.join(root,s.image));
 if(s.video)args.push('-i',path.join(root,s.video));
 args.push('-i',s.audioPath);
 let filter=hasMedia?`[1:v]scale=250:480:force_original_aspect_ratio=decrease,pad=250:480:(ow-iw)/2:(oh-ih)/2:color=0x101e30,setsar=1,tpad=stop_mode=clone:stop_duration=${seconds}[screen];[0:v][screen]overlay=950:40:shortest=0[base];`:'';
 filter+=(hasMedia?'[base]':'[0:v]')+`drawbox=x=64:y=112:w=74:h=5:color=0x42d4b4:t=fill,drawtext=fontfile='${font}':textfile=${s.id}-tag.txt:fontsize=20:fontcolor=0x42d4b4:x=64:y=64,drawtext=fontfile='${font}':textfile=${s.id}-title.txt:fontsize=42:fontcolor=white:x=64:y=155,drawtext=fontfile='${font}':textfile=${s.id}-points.txt:fontsize=27:line_spacing=24:fontcolor=0xc5d5e8:x=64:y=258,drawtext=fontfile='${font}':textfile=disclosure.txt:fontsize=15:fontcolor=0x8aa1bb:x=64:y=486,drawbox=x=40:y=548:w=1200:h=146:color=0x08121f:t=fill,drawtext=fontfile='${font}':textfile=${s.id}-caption.txt:fontsize=24:line_spacing=10:fontcolor=white:x=70:y=567,fade=t=in:d=0.4,fade=t=out:st=${seconds-0.4}:d=0.4[v]`;
 args.push('-filter_complex',filter,'-map','[v]','-map',`${hasMedia?2:1}:a`,'-af',`atempo=${speechSpeed},apad`,'-t',String(seconds),'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-ar','48000',s.id+'.mp4');
 run(ff,args);chapters.push({title:s.title,start,duration:dur(s.id+'.mp4')});start+=chapters.at(-1).duration;console.log('SCENE',s.id,seconds.toFixed(1));
}
fs.writeFileSync(path.join(out,'concat.txt'),scenes.map(s=>`file '${s.id}.mp4'`).join('\n'));
run(ff,['-v','error','-y','-f','concat','-safe','0','-i','concat.txt','-c','copy','-movflags','+faststart','app-introduction.mp4']);
run(ff,['-v','error','-i','app-introduction.mp4','-f','null','-']);
for(const [i,c]of chapters.entries())run(ff,['-v','error','-y','-ss',String(c.start+c.duration/2),'-i','app-introduction.mp4','-frames:v','1',`preview-${i+1}.jpg`]);
fs.writeFileSync(path.join(out,'chapters.json'),JSON.stringify(chapters,null,2));
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>智慧照護 APP｜故事與專題介紹</title><style>body{background:#101e30;color:white;font:18px system-ui;max-width:1100px;margin:30px auto}video{width:100%}button{margin:6px;padding:10px;background:#25435c;color:white;border:0;border-radius:6px}p{line-height:1.8}</style><h1>智慧照護 APP｜故事 × 專題介紹</h1><p>合成照護情境、實際介面截圖與錄影，搭配中文合成旁白。不是醫療建議或完整實機驗收。</p><video id="v" controls src="app-introduction.mp4"></video>${chapters.map(c=>`<button onclick="v.currentTime=${c.start};v.play()">${c.title}</button>`).join('')}</html>`);
console.log('DONE',JSON.stringify({out,duration:start,bytes:fs.statSync(path.join(out,'app-introduction.mp4')).size}));
