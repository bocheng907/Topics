// Render genuine recorded UI chapters. Does not alter the application or test results.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const shortMode = process.argv.includes('--short');
const retryMode = process.argv.includes('--retry');
const out = path.resolve(__dirname, '../output/playwright/flow-review-20261020' + (shortMode ? '-short' : '') + (retryMode ? '-retry' : ''));
const result = JSON.parse(fs.readFileSync(path.join(out, 'results.json'), 'utf8'));
const ffmpeg = 'C:/ffmpeg/bin/ffmpeg.exe';
const ffprobe = 'C:/ffmpeg/bin/ffprobe.exe';
function run(program, args) {
  const r = spawnSync(program, args, {cwd: out, encoding: 'utf8', maxBuffer: 4e6});
  if (r.status !== 0) throw Error(r.stderr || `${program} failed`);
  return r.stdout;
}
function duration(file) {
  return Number(run(ffprobe, ['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',file]).trim());
}
const selections = shortMode ? result.steps.map((s,i)=>[i+1,(s.passed ? '' : '未通過｜')+s.name]) : [
  [3, '家屬註冊｜實際成功，原腳本導向預期錯誤', 0, 10],
  [4, '待改善｜建立逾時，後端仍建立長者', -7, 7],
  [5, '照護員註冊成功'], [7, '從長者清單恢復選取'],
  [8, '照護員送出加入申請'], [9, '主要家屬核准申請'], [10, '照護員進入長者首頁'],
  [11, '新增健康紀錄'], [12, '家屬首頁同步健康數據'],
  [13, '照護員傳送交班訊息'], [14, '家屬收到並回覆'], [15, '照護員收到回覆'],
  [16, '發布看護手冊｜儲存後另行驗證'], [17, '重新開啟確認手冊已保存'],
  [18, '照護員確認接班'], [19, '家屬查看接班確認'],
  [20, '待改善｜選單遮住社群發布按鈕', 0, 8],
  [21, '改點按鈕下緣｜文章已寫入', 0, 5],
  [22, '社群列表開啟新文章'], [23, '新增社群留言'],
  [24, '家屬下載含聊天、社群資料的 JSON'], [25, '照護員下載含健康紀錄的 JSON'],
  [26, '申請帳號刪除並登出'], [27, '緩衝期登入｜確認期限為 30 天'],
  [28, '取消刪除並重新登入'], [29, '一般帳號禁止查閱 Audit Log'],
  [30, '本機授權管理員查閱 Audit Log'], [31, '新增回診交接記事'],
];
fs.writeFileSync(path.join(out, 'footer.txt'), '本機模擬器 · 合成資料 · 真實瀏覽器操作\n不是正式環境或 iPhone 實機驗收；無旁白');
const timeline = [];
let offset = 0;
for (const [index, title, shift, cap] of selections) {
  const s = result.steps[index - 1], id = String(index).padStart(2,'0');
  const source = `${s.actor}.webm`;
  const sourceDuration = duration(source);
  const start = shift < 0 ? s.end + shift : s.start;
  const length = Math.min(cap || (shortMode ? 30 : 12), s.end - start, sourceDuration - start);
  if (!(length > 0)) throw Error(`Recording timestamp outside source for ${index}: ${sourceDuration}`);
  fs.writeFileSync(path.join(out, `caption-${id}.txt`), `${id}  ${title}\n${s.actor === 'caregiver' ? '照護員：林怡君' : '家屬：陳雅婷'}`);
  run(ffmpeg, ['-hide_banner','-loglevel','error','-nostdin','-y','-ss',String(start),'-t',String(length),'-i',source,
    '-vf',`fps=25,scale=432:864,pad=720:1080:144:118:color=0x101c31,drawtext=fontfile='C\\:/Windows/Fonts/msjh.ttc':textfile=caption-${id}.txt:fontsize=22:fontcolor=white:x=24:y=22:line_spacing=12,drawtext=fontfile='C\\:/Windows/Fonts/msjh.ttc':textfile=footer.txt:fontsize=17:fontcolor=0xbecce0:x=24:y=1002:line_spacing=8,tpad=stop_mode=clone:stop_duration=3`,
    '-an','-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p',`clip-${id}.mp4`]);
  const seconds = duration(`clip-${id}.mp4`);
  timeline.push({index,title,seconds:offset,duration:seconds,source,start});
  offset += seconds;
  console.log('Rendered', id, title);
}
fs.writeFileSync(path.join(out,'concat.txt'), timeline.map(x=>`file 'clip-${String(x.index).padStart(2,'0')}.mp4'`).join('\n'));
run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-y','-f','concat','-safe','0','-i','concat.txt','-c','copy','-movflags','+faststart','flow-review.mp4']);
fs.writeFileSync(path.join(out,'chapters.json'),JSON.stringify(timeline,null,2));
const clock = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>照護流程實測錄影</title><style>body{background:#101c31;color:#eaf2ff;font:16px system-ui;margin:0;padding:24px}main{max-width:1080px;margin:auto}p{line-height:1.7;color:#c6d4e8}.grid{display:grid;grid-template-columns:minmax(280px,600px) 1fr;gap:24px}video{width:100%;max-height:85vh}button{background:#243952;color:white;border:0;border-radius:8px;padding:12px;display:block;width:100%;text-align:left;margin-bottom:8px;cursor:pointer}a{color:#a7dbff}@media(max-width:700px){.grid{display:block}}</style><main><h1>照護流程實測錄影</h1><p>2026-10-20｜本機 Firebase Emulator＋合成帳號。真實瀏覽器操作，已刪去等待、每段結尾停留 3 秒，無旁白。未部署或更動正式資料。</p><p>注意：建立長者逾時及社群按鈕遮擋尚待修正。影片不是「所有功能通過」的宣告，也不是 iPhone 實測。</p><div class="grid"><video id="v" src="flow-review.mp4" controls playsinline></video><nav>${timeline.map(t=>`<button onclick="v.currentTime=${t.seconds};v.play()">${clock(t.seconds)} ${t.title}</button>`).join('')}</nav></div><p><a href="flow-review.mp4" download>下載影片</a> · <a href="REPORT.md">測試報告</a> · <a href="results.json">原始判定</a></p></main></html>`);
console.log('Finished',JSON.stringify({file:path.join(out,'flow-review.mp4'),seconds:duration('flow-review.mp4'),chapters:timeline.length}));
