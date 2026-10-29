/* Isolated UI regression: real chat screens + RN Web, synthetic services only. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.env.ACCEPTANCE_OUTPUT || path.join(root, 'output/playwright/chat-layout'));
const runtime = 'C:/Users/boche/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const pw = require(process.env.PLAYWRIGHT_MODULE || path.join(runtime, 'playwright'));
const modules = [], ids = new Map();
const mocks = {
  'expo-router': `exports.router={canGoBack:()=>!!window.model.canGoBack,back(){window.navigation.push('back')},replace(path){window.navigation.push(path)},push(){}};exports.useLocalSearchParams=()=>({patientId:window.model.patient,room:'caregiver'});exports.useFocusEffect=cb=>require('react').useEffect(cb,[cb]);`,
  '@expo/vector-icons': `const R=require('react'),N=require('react-native');exports.Ionicons=p=>R.createElement(N.Text,{'aria-hidden':true},'●');`,
  'expo-image-picker': `module.exports={};`,
  'expo-crypto': `exports.randomUUID=()=>crypto.randomUUID();`,
  'firebase/storage': `module.exports={};`,
  'firebase/firestore': `exports.collection=(...a)=>a;exports.query=(...a)=>a;exports.where=(...a)=>a;exports.orderBy=()=>null;exports.limit=()=>null;exports.onSnapshot=(q,ok)=>{let active=true;const own=JSON.stringify(q).includes('users');const notify=()=>{if(!active)return;ok(own?{size:window.ownProfile?1:0,docs:window.ownProfile?[{data:()=>window.ownProfile}]:[]}:{empty:false,docs:window.messages.map((m,i)=>({id:String(i),data:()=>m}))})};if(own)window.profileNotify=notify;queueMicrotask(notify);return()=>{active=false}};`,
  'firebase/functions': `exports.httpsCallable=()=>async()=>({data:{profiles:window.remoteProfiles||{}}});`,
  '@/firebase/firebaseConfig': `exports.db={};exports.storage={};`,
  '@/firebase/uploadFilename': `exports.createImageUploadFilename=()=>'';`,
  '@/src/ui/AppAlert': `exports.AppAlert={alert(){}};`,
  '@/src/user/getUserDocRefByUid': `exports.getUserDocSnapshotByUid=async()=>null;`,
  '@/src/media/readLocalBlob': `module.exports={};`,
  '@/src/care-target/useActiveCareTarget': `exports.useActiveCareTarget=()=>({activePatientId:window.model.patient,activePatient:{name:'陳建國'}});`,
  '@/src/auth/useAuth': `exports.useAuth=()=>({user:{uid:window.model.uid}});`,
  '@/src/store/LanguageContext': `const R=require('react');exports.useLanguage=()=>({language:R.useSyncExternalStore(cb=>{window.addEventListener('model',cb);return()=>window.removeEventListener('model',cb)},()=>window.model.language)});`,
  'react-native-safe-area-context': `const R=require('react'),N=require('react-native');exports.useSafeAreaInsets=()=>({top:20,bottom:0,left:0,right:0});exports.SafeAreaView=({edges,...p})=>R.createElement(N.View,p);`,
  '@/src/api/analyzePrescription': `exports.translateTexts=async(items,language,signal)=>{window.requests.push({items,language});if(window.model.delay)await new Promise(r=>setTimeout(r,window.model.delay));if(signal.aborted)throw Error('aborted');if(window.model.fail)throw Error('offline');return{translations:items.map(i=>({key:i.key,translated_text:window.words[language][Number(i.text.includes('有沒有'))]}))}};`,
};
function normalize(name, from) {
  if (name === 'react-native') name = 'react-native-web';
  if (mocks[name]) return name;
  let target = name.startsWith('@/') ? path.join(root, name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(from), name) : name;
  if (target === path.join(root, 'src/api/analyzePrescription')) return '@/src/api/analyzePrescription';
  if (target === path.join(root, 'src/store/LanguageContext')) return '@/src/store/LanguageContext';
  if (path.isAbsolute(target)) {
    for (const ext of ['', '.ts', '.tsx', '.js', '/index.js']) if (fs.existsSync(target + ext) && fs.statSync(target + ext).isFile()) return target + ext;
  }
  return require.resolve(target, { paths: [path.dirname(from), root] });
}
function bundle(file) {
  if (ids.has(file)) return ids.get(file);
  const id = modules.length; ids.set(file, id); modules.push(null);
  const raw = mocks[file] || fs.readFileSync(file, 'utf8');
  let code = file.endsWith('.json') ? 'module.exports=' + raw : ts.transpileModule(raw, {
    fileName: file.endsWith('.tsx') ? file : 'module.ts', compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const deps = {};
  const ast = ts.createSourceFile('module.js', code, ts.ScriptTarget.Latest, true);
  function visit(n) {
    if (ts.isCallExpression(n) && n.expression.getText(ast) === 'require' && n.arguments.length === 1 && ts.isStringLiteral(n.arguments[0])) {
      const name = n.arguments[0].text;
      deps[name] = bundle(normalize(name, file));
    }
    ts.forEachChild(n, visit);
  }
  visit(ast);
  modules[id] = `[function(require,module,exports){${code}\n},${JSON.stringify(deps)}]`;
  return id;
}
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const react = bundle(require.resolve('react'));
  const client = bundle(require.resolve('react-dom/client'));
  const screens = {};
  for (const role of ['caregiver', 'family']) for (const page of ['chat-room', 'chat-list']) screens[`${role}/${page}`] = bundle(path.join(root, 'app', role, page + '.tsx'));
  const script = `window.process={env:{NODE_ENV:'development'}};var modules=[${modules.join(',')}],cache={};function load(id){if(cache[id])return cache[id].exports;var m=cache[id]={exports:{}};modules[id][0](name=>load(modules[id][1][name]),m,m.exports);return m.exports;}
  window.model={language:'zh',uid:'viewer',patient:'synthetic-patient',fail:false};window.requests=[];window.navigation=[];
  window.words={'Traditional Chinese':['陳爺爺今天狀況還好嗎','有沒有哪裡不舒服或有狀況'],'English':['How is Grandpa Chen feeling today?','Is he feeling uncomfortable anywhere today?'],'Vietnamese':['Hôm nay ông Trần cảm thấy thế nào?','Ông có cảm thấy khó chịu ở đâu không?'],'Indonesian':['Bagaimana kondisi Kakek Chen hari ini?','Apakah ada bagian tubuh yang terasa tidak nyaman?']};
  window.messages=[{text:'陳爺爺今天狀況還好嗎',senderName:'陳亮玫',senderId:'family',createdAt:{toMillis:()=>1700000000000}},{text:'有沒有哪裡不舒服或有狀況',senderName:'陳柏丞',senderId:'viewer',createdAt:{toMillis:()=>1700000060000}}];
  var R=load(${react}),root=load(${client}).createRoot(document.getElementById('root'));var screens=${JSON.stringify(screens)};
  window.show=(screen,changes={})=>{Object.assign(window.model,changes);window.dispatchEvent(new Event('model'));root.render(R.createElement(load(screens[screen]).default,{key:screen+window.model.patient+window.model.uid}));};`;
  const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => route.abort()); // Never contact production.
  const results = [];
  try {
    await page.setContent('<html><head><style>html,body,#root{height:100%;margin:0}#root{display:flex;flex-direction:column}</style></head><body><div id="root"></div></body></html>');
    await page.addScriptTag({ content: script });
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const screen of Object.keys(screens)) for (const language of ['zh', 'en', 'vi', 'id']) {
        await page.evaluate(([screen, language]) => window.show(screen, { language }), [screen, language]);
        const expected = await page.evaluate(language => window.words[({zh:'Traditional Chinese',en:'English',vi:'Vietnamese',id:'Indonesian'})[language]][0], language);
        await page.getByText(expected, { exact: true }).first().waitFor();
        await page.waitForFunction(() => !/正在翻譯訊息|Translating messages|Đang dịch tin nhắn|Menerjemahkan pesan/.test(document.body.innerText));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${screen} overflow at ${width}`);
        if (screen.endsWith('room')) {
          const box = await page.getByText(expected, { exact: true }).boundingBox();
          assert.ok(box && box.y > 50 && box.x >= 0 && box.x + box.width <= width, `${screen} message hidden`);
        }
        await page.screenshot({ path: path.join(out, `${screen.replace('/', '-')}-${language}-${width}.png`) });
        results.push(`${screen} ${language} ${width}`);
      }
    }
    for (const role of ['caregiver', 'family']) {
      for (const canGoBack of [false, true]) {
        await page.evaluate(([role, canGoBack]) => window.show(role+'/chat-room', {language:'en',canGoBack}), [role,canGoBack]);
        await page.getByRole('button', {name:'Back',exact:true}).click();
        assert.equal(await page.evaluate(()=>window.navigation.at(-1)),canGoBack?'back':`/${role}/chat-list`);
        results.push(`${role}: ${canGoBack?'existing history returns normally':'empty history returns to chat list'}`);
      }
    }
    await page.evaluate(() => window.show('caregiver/chat-room', { patient:'failure-case', language:'en', fail:true }));
    await page.getByText('Some messages could not be translated. Original text is shown.', { exact:true }).waitFor();
    await page.getByText('陳爺爺今天狀況還好嗎', { exact:true }).waitFor();
    await page.evaluate(() => {window.model.fail=false});
    await page.getByRole('button', {name:'Retry translation'}).click();
    await page.getByText('How is Grandpa Chen feeling today?', { exact:true }).waitFor();
    results.push('Failure preserves original and retry succeeds');
    await page.evaluate(() => window.show('caregiver/chat-room', {patient:'race-case',language:'en',delay:500}));
    await page.waitForTimeout(200);
    await page.evaluate(() => window.show('caregiver/chat-room', {language:'id',delay:0}));
    await page.getByText('Bagaimana kondisi Kakek Chen hari ini?', { exact:true }).waitFor();
    await page.waitForTimeout(600);
    assert.equal(await page.getByText('How is Grandpa Chen feeling today?', { exact:true }).count(),0);
    results.push('Stale language response ignored');
    await page.evaluate(() => {
      window.messages=[{text:'Bagaimana kondisi Kakek Chen hari ini?',text_zh:'Bagaimana kondisi Kakek Chen hari ini?',senderId:'family',senderName:'陳亮玫',createdAt:{toMillis:()=>1700000000000}}];
      window.show('caregiver/chat-room',{patient:'reverse-translation',language:'zh'});
    });
    await page.getByText('陳爺爺今天狀況還好嗎',{exact:true}).waitFor();
    assert.equal(await page.getByText('Bagaimana kondisi Kakek Chen hari ini?',{exact:true}).count(),0);
    results.push('Foreign original with legacy text_zh translates back to Chinese');
    for (const screen of ['caregiver/chat-room','family/chat-room']) {
      await page.setViewportSize({width:320,height:568});
      await page.evaluate(screen=>{
        window.words.English[0]='Please prepare the appointment documents and bring them tomorrow. '.repeat(12);
        window.messages[0].senderName='Very long family member display name for layout checking';
        window.show(screen,{patient:'long-'+screen,language:'en'});
      },screen);
      await page.getByText(/Please prepare the appointment/).waitFor();
      // Use the actual input regardless of translated copy wording.
      await page.locator('textarea').fill('I will bring the documents tomorrow.\n'.repeat(12));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      const box=await page.locator('textarea').boundingBox();
      assert.ok(box && box.y>=0 && box.y+box.height<=568);
      await page.screenshot({path:path.join(out,screen.replace('/','-')+'-long-text.png')});
      results.push(screen+' long message, long name, multiline draft at 320x568');
    }
    for (const role of ['caregiver','family']) {
      await page.evaluate(role=>{
        window.ownProfile={displayName:'阿蘭',avatarUrl:''};
        window.remoteProfiles={family:{displayName:'家屬新名字',avatarUrl:''}};
        window.messages=[{senderId:'viewer',senderName:'陳柏丞',senderAvatarUrl:'https://example.invalid/old.png',text:'hello'},
          {senderId:'family',senderName:'舊家屬',text:'reply'}];
        window.show(role+'/chat-room',{patient:'identity-'+role,language:'zh'});
      },role);
      await page.getByText('阿蘭 · 我',{exact:true}).waitFor();
      await page.getByText('家屬新名字',{exact:true}).waitFor();
      assert.equal(await page.getByText('陳柏丞 · 我',{exact:true}).count(),0);
      assert.equal(await page.locator('img[src="https://example.invalid/old.png"]').count(),0);
      await page.evaluate(()=>{window.ownProfile={displayName:'阿蘭更新',avatarUrl:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'};window.profileNotify()});
      await page.getByText('阿蘭更新 · 我',{exact:true}).waitFor();
      assert.equal(await page.locator('img').count(),1);
      await page.screenshot({path:path.join(out,role+'-profile-updated.png')});
      await page.evaluate(()=>{window.ownProfile={displayName:'阿蘭更新',avatarUrl:''};window.profileNotify()});
      await page.waitForFunction(()=>document.querySelectorAll('img').length===0);
      results.push(role+' live profile updates historical messages and clears avatar');
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors,scope:'Synthetic services; actual React Native Web chat components. Not iPhone verification.'},null,2));
    console.log(`PASS ${results.length} browser cases; screenshots: ${out}`);
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1});
