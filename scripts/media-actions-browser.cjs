/* Real media screen + React Native Web. Synthetic Firestore only; all network
 * traffic is blocked. This is not a production or native iPhone test. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.env.ACCEPTANCE_OUTPUT || path.join(root, 'output/playwright/media-actions-fix'));
const {chromium} = require(process.env.PLAYWRIGHT_MODULE ||
  'C:/Users/boche/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const modules = [], ids = new Map();
const mocks = {
  'expo-router': `const nav={getParent:()=>({setOptions(){}})};exports.useNavigation=()=>nav;exports.router={back(){}};`,
  '@expo/vector-icons': `const R=require('react'),N=require('react-native');exports.Feather=exports.Ionicons=p=>R.createElement(N.Text,{},p.name);`,
  'expo-image-picker': `module.exports={};`,
  'expo-crypto': `exports.randomUUID=()=>crypto.randomUUID();`,
  'firebase/storage': `module.exports={};`,
  '@/firebase/firebaseConfig': `exports.db={};exports.storage={};`,
  '@/firebase/uploadFilename': `exports.createMediaUploadFilename=()=>'';`,
  '@/src/media/readLocalBlob': `module.exports={};`,
  '@/src/media/VideoPlayerView': `const R=require('react'),N=require('react-native');exports.__esModule=true;exports.default=p=>R.createElement(N.View,{style:p.style},R.createElement('video',{controls:true,style:{width:'100%',height:'100%'}}));`,
  '@/src/auth/useAuth': `exports.useAuth=()=>({user:{uid:'viewer'}});`,
  '@/src/care-target/useActiveCareTarget': `exports.useActiveCareTarget=()=>({activePatientId:'linked'});`,
  '@/src/store/LanguageContext': `exports.useLanguage=()=>({language:window.language});`,
  'react-native-safe-area-context': `const R=require('react'),N=require('react-native');exports.useSafeAreaInsets=()=>({top:0,bottom:0,left:0,right:0});exports.SafeAreaView=({edges,...p})=>R.createElement(N.View,p);`,
  '@/src/i18n/dynamicTranslation': `exports.ensureAbnormalRecordEntryTranslation=exports.ensureFirestoreTranslations=async()=>{};exports.pickDynamicLocalizedString=(r,b,l,keys,fallback)=>fallback;`,
  '@/src/ui/AppAlert': `exports.AppAlert={alert:(title,message,buttons)=>{window.alerts.push({title,message});window.pendingButtons=buttons;}};`,
  'firebase/firestore': `
    exports.collection=(db,name)=>({name});exports.query=q=>q;exports.where=()=>null;
    exports.doc=(db,name,id)=>({name,id});exports.serverTimestamp=()=>new Date();
    exports.arrayRemove=value=>({remove:value});exports.arrayUnion=value=>({add:value});
    exports.onSnapshot=(q,ok)=>{window.notify=()=>ok({docs:window.records.map(r=>({id:r.id,data:()=>r}))});queueMicrotask(window.notify);return()=>{window.notify=()=>{}};};
    exports.updateDoc=async(ref,patch)=>{window.writes.push({op:'update',id:ref.id});let r=window.records.find(r=>r.id===ref.id);if(patch.entries?.remove)patch={...patch,entries:r.entries.filter(e=>e.entryId!==patch.entries.remove.entryId)};Object.assign(r,patch);window.records=window.records.map(r=>({...r}));window.notify();};
    exports.deleteDoc=async(ref)=>{window.writes.push({op:'delete',id:ref.id});window.records=window.records.filter(r=>r.id!==ref.id);window.notify();};
    exports.setDoc=async()=>{throw Error('unexpected create');};`,
};
function resolve(name, from) {
  if (name === 'react-native') name = 'react-native-web';
  if (mocks[name]) return name;
  const target = name.startsWith('@/') ? path.join(root,name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(from),name) : name;
  if (path.isAbsolute(target)) for (const ext of ['', '.ts', '.tsx', '.js', '/index.js']) {
    if (fs.existsSync(target+ext) && fs.statSync(target+ext).isFile()) return target+ext;
  }
  return require.resolve(target,{paths:[path.dirname(from),root]});
}
function bundle(file) {
  if(ids.has(file))return ids.get(file);
  const id=modules.length;ids.set(file,id);modules.push(null);
  const raw=mocks[file]||fs.readFileSync(file,'utf8');
  const code=file.endsWith('.json')?'module.exports='+raw:ts.transpileModule(raw,{fileName:file.endsWith('.tsx')?file:'module.ts',compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
  const deps={},ast=ts.createSourceFile('m.js',code,ts.ScriptTarget.Latest,true);
  function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='require'&&n.arguments.length===1&&ts.isStringLiteral(n.arguments[0])){const name=n.arguments[0].text;deps[name]=bundle(resolve(name,file));}ts.forEachChild(n,visit);}
  visit(ast);modules[id]=`[function(require,module,exports){${code}\n},${JSON.stringify(deps)}]`;return id;
}
async function main(){
  fs.mkdirSync(out,{recursive:true});
  const react=bundle(require.resolve('react')),client=bundle(require.resolve('react-dom/client'));
  const screen=bundle(path.join(root,'app/caregiver/video-record.tsx'));
  const copyId=bundle(path.join(root,'src/media/recordCopy.ts'));
  const translationsId=bundle(path.join(root,'src/i18n/translations.ts'));
  const script=`window.process={env:{NODE_ENV:'development'}};var modules=[${modules.join(',')}],cache={};function load(id){if(cache[id])return cache[id].exports;var m=cache[id]={exports:{}};modules[id][0](name=>load(modules[id][1][name]),m,m.exports);return m.exports;}
    window.records=[];window.alerts=[];window.writes=[];window.copy=load(${copyId}).recordCopy;window.t=load(${translationsId}).translations;
    var R=load(${react}),root=load(${client}).createRoot(document.getElementById('root'));window.mount=()=>root.render(R.createElement(load(${screen}).default));`;
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const results=[];let activePage;
  try {
    for(const language of ['zh','en','vi','id'])for(const width of [375,480]){
      const context=await browser.newContext({viewport:{width,height:812}});
      await context.route('**/*',r=>r.abort());
      const page=await context.newPage();activePage=page;page.setDefaultTimeout(8000);
      const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
      await page.setContent('<html><style>html,body,#root{height:100%;margin:0}#root{display:flex;flex-direction:column}</style><div id="root"></div></html>');
      await page.addScriptTag({content:script});
      const {copy,t}=await page.evaluate(({language})=>{
        window.language=language;
        window.records=[{id:'folder',type:'folder',titleOriginal:'回診用品與活動空間',notesOriginal:'交班用品',createdAt:new Date(),entries:[
          {entryId:'photo',notesOriginal:'筆記本與筆',mediaType:'image',mediaUrl:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',createdAt:new Date()},
          {entryId:'video',notesOriginal:'活動空間配置',mediaType:'video',mediaUrl:'synthetic',createdAt:new Date()}]},
          {id:'single',type:'single',titleOriginal:'單次照片',notesOriginal:'用品照片',hasMedia:false,createdAt:new Date()}];
        window.mount();return{copy:window.copy[language],t:window.t[language]};
      },{language});
      const text=s=>page.getByText(s,{exact:true}).filter({visible:true}).last();
      const actions=()=>page.getByRole('button',{name:copy.actions,exact:true});
      const menuButton=name=>page.getByRole('button',{name,exact:true});
      await text('回診用品與活動空間').click();
      await text(t.todayRecords).click();
      await text(copy.addEntry+': 回診用品與活動空間').waitFor();
      await page.screenshot({path:path.join(out,`${language}-${width}-add-entry.png`),animations:'disabled'});
      await text(t.back).click();
      // Folder edit and cancel operate with real pointer clicks, never force/focus.
      await actions().click();await menuButton(t.cancel).click();await menuButton(t.edit).waitFor({state:'hidden'});
      await actions().click();await menuButton(t.edit).click();await text(copy.edit).waitFor();await text(t.back).click();
      for(const note of ['筆記本與筆','活動空間配置']){
        await text(note).click();await actions().click();
        await page.screenshot({path:path.join(out,`${language}-${width}-${note}-menu.png`),animations:'disabled'});
        await menuButton(t.edit).click();await text(copy.edit).waitFor();
        await page.locator('textarea').fill(note+'，方便交班時查看。');
        await text('check').click();await page.locator('textarea').waitFor({state:'hidden'});
        await text(note+'，方便交班時查看。').waitFor();
        await actions().click();await menuButton(t.delete).click();
        assert.equal(await page.evaluate(()=>window.alerts.at(-1).message),copy.deleteEntry);
        // Simulate cancel callback from native confirm; no entry may disappear.
        await page.evaluate(()=>window.pendingButtons.find(b=>b.style==='cancel').onPress?.());
        assert.equal(await page.evaluate(()=>window.records[0].entries.length),2);
        await text(t.back).click();
      }
      // Deleting the photo removes only that item, retaining the sibling video.
      await text('筆記本與筆，方便交班時查看。').click();await actions().click();await menuButton(t.delete).click();
      await page.evaluate(()=>window.pendingButtons.find(b=>b.style==='destructive').onPress());
      await text(t.todayRecords).waitFor();
      assert.deepEqual(await page.evaluate(()=>window.records[0].entries.map(e=>e.entryId)),['video']);
      await actions().click();await menuButton(t.delete).click();
      assert.equal(await page.evaluate(()=>window.alerts.at(-1).message),copy.deleteFolder);
      await text(t.back).click();await text('單次照片').click();
      await actions().click();await menuButton(t.edit).click();await text(copy.edit).waitFor();await text(t.back).click();
      await actions().click();await menuButton(t.delete).click();
      assert.equal(await page.evaluate(()=>window.alerts.at(-1).message),copy.deleteRecord);
      assert.deepEqual(errors,[]);
      results.push({language,width,status:'passed',checks:'folder/photo/video/single pointer actions, edit, cancel, targeted delete, contextual copy'});
      await context.close();
    }
  } catch(error) {
    if(activePage&&!activePage.isClosed()){
      await activePage.screenshot({path:path.join(out,'failure.png')});
      console.error(await activePage.locator('body').innerText());
    }
    throw error;
  } finally {await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
  console.log(JSON.stringify(results,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
