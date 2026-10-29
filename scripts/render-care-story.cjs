/* Assemble only verified UI recordings; preserve the two original videos. */
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const out = path.resolve(__dirname, '../output/playwright/care-story-film');
const data = JSON.parse(fs.readFileSync(path.join(out, 'recording.json'), 'utf8'));
if (data.chapters.length !== 17 || data.chapters.some(x => !x.passed)) throw Error('All 17 UI chapters must pass before assembly');
const ffmpeg = 'C:/ffmpeg/bin/ffmpeg.exe';
function run(args) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', ...args], {cwd: out, encoding: 'utf8'});
  if (result.status !== 0) throw Error(result.stderr || 'ffmpeg failed');
}
let offset = 0;
const timeline = [];
for (const [i, chapter] of data.chapters.entries()) {
  const id = String(i + 1).padStart(2, '0');
  const title = id + '  ' + chapter.name;
  fs.writeFileSync(path.join(out, `title-${id}.txt`), title);
  const duration = chapter.end - chapter.start;
  run(['-y', '-ss', String(chapter.start), '-t', String(duration), '-i', `${chapter.actor}.webm`,
    '-vf', `fps=25,pad=720:1080:120:80:color=0x101c31,drawtext=fontfile='C\\:/Windows/Fonts/msjh.ttc':textfile=title-${id}.txt:fontsize=23:fontcolor=white:x=(w-text_w)/2:y=25,tpad=stop_mode=clone:stop_duration=2`,
    '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '21', '-pix_fmt', 'yuv420p', `chapter-${id}.mp4`]);
  timeline.push({title: chapter.name, seconds: offset, actor: chapter.actor});
  offset += Math.ceil(duration * 25) / 25 + 2;
  console.log('RENDER', title);
}
fs.writeFileSync(path.join(out, 'concat.txt'), data.chapters.map((_, i) => `file 'chapter-${String(i+1).padStart(2,'0')}.mp4'`).join('\n'));
run(['-y', '-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', '-movflags', '+faststart', 'care-story.mp4']);
const clock = n => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
fs.writeFileSync(path.join(out, 'chapters.json'), JSON.stringify(timeline, null, 2));
fs.writeFileSync(path.join(out, 'README.md'), `# 日常照護流程錄影\n\n人物與資料皆為虛構；在 demo-care-walkthrough 本機隔離模擬器操作。未建立正式帳號、未傳訊給真實家屬。\n\n17 個操作章節完成：註冊兩個帳號、建立長者、邀請與核准、登出登入、健康回報與家屬端同步、五則雙向訊息、重新開啟確認保存。\n\n影片為真實瀏覽器操作，依照角色與章節剪輯；移除等待並在段尾停留 2 秒。不是手機實機錄影，也不是所有功能的全面驗收。原始影片保留於 family.webm 與 caregiver.webm。\n\n隔離網路阻擋了 QR 解碼器的外部 CDN，產生載入錯誤；本次使用手動輸入邀請碼，不宣稱驗證 QR 掃碼、OCR、推播或影音權限。\n\n` + timeline.map(c => `- ${clock(c.seconds)} ${c.title}`).join('\n') + '\n');
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>日常照護流程</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#101c31;color:#eaf2ff;font:16px system-ui;padding:28px}main{max-width:1050px;margin:auto}h1{font-size:28px}p{line-height:1.8;color:#becce0}.grid{display:grid;grid-template-columns:minmax(280px,600px) 1fr;gap:24px}video{width:100%;max-height:80vh;background:black;border-radius:12px}button{display:block;width:100%;text-align:left;background:#21324c;color:#eaf2ff;border:0;border-radius:8px;padding:12px;margin-bottom:8px;cursor:pointer}a{color:#9edbff}@media(max-width:700px){.grid{display:block}}</style><main><h1>陳建國的日常照護</h1><p>家屬 陳雅婷 × 照護員 林怡君<br>虛構人物與資料，於本機隔離環境操作。影片保留實際頁面，依角色切換剪輯。</p><div class="grid"><video id="v" src="care-story.mp4" controls playsinline></video><nav>${timeline.map(c => `<button onclick="v.currentTime=${c.seconds};v.play()">${clock(c.seconds)}　${c.title}</button>`).join('')}</nav></div><p><a href="care-story.mp4" download>下載 MP4</a> · <a href="family.webm">家屬原始錄影</a> · <a href="caregiver.webm">照護員原始錄影</a></p></main></html>`);
console.log('DONE', path.join(out, 'care-story.mp4'));
