// Isolated regression tests. No production reads, writes, login or messages.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const read = file => fs.readFileSync(require.resolve('../'+file), 'utf8');
function compile(source, bindings = {}) {
  const exports = {};
  new Function('exports', ...Object.keys(bindings), ts.transpileModule(source, {
    compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText)(exports,...Object.values(bindings));
  return exports;
}
function handler(file,name,bindings) {
  const source=read(file), ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let found;
  function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)found=n.initializer;ts.forEachChild(n,visit);}
  visit(ast);assert.ok(found,name);return compile('exports.run='+found.getText(ast),bindings).run;
}
const {eventCopy} = compile(read('src/ui/calendarEventCopy.ts'));
for (const language of ['zh','en','vi','id']) {
  test(language+': calendar requires confirmation; cancel preserves event',async()=>{
    const alerts=[],writes=[];
    const remove=handler('app/caregiver/calendar.tsx','handleDeleteEvent',{
      eventCopy,language,Alert:{alert:(...a)=>alerts.push(a)},
      doc:(_db,name,id)=>({name,id}),db:{},CALENDAR_EVENTS_COLLECTION:'calendar_events',
      deleteDoc:async ref=>writes.push(ref),console:{log(){}},
    });
    remove('only-this-event');assert.equal(writes.length,0);
    assert.equal(alerts[0][1],eventCopy[language].confirm);
    alerts[0][2].find(b=>b.style==='cancel').onPress?.();assert.equal(writes.length,0);
    remove('only-this-event');
    const confirmed=alerts[1][2].find(b=>b.style==='destructive');
    await Promise.all([confirmed.onPress(),confirmed.onPress()]);
    assert.deepEqual(writes,[{name:'calendar_events',id:'only-this-event'}]);
  });
}
test('calendar reports failure without leaking backend errors; a fresh attempt can retry',async()=>{
  const alerts=[];let attempts=0;
  const remove=handler('app/caregiver/calendar.tsx','handleDeleteEvent',{
    eventCopy,language:'zh',Alert:{alert:(...a)=>alerts.push(a)},doc:()=>({}),db:{},
    CALENDAR_EVENTS_COLLECTION:'calendar_events',console:{log(){}},
    deleteDoc:async()=>{if(++attempts===1)throw Error('private details');},
  });
  remove('e');await alerts[0][2][1].onPress();assert.equal(alerts[1][1],eventCopy.zh.retry);
  remove('e');await alerts[2][2][1].onPress();assert.equal(attempts,2);
});
test('missing or empty audio shows a visible web alert and never starts playback',async()=>{
  const messages=[];
  const {AppAlert}=compile(read('src/ui/AppAlert.web.ts'),{window:{alert:text=>messages.push(text)}});
  assert.match(read('app/caregiver/communication-cards.tsx'),/AppAlert as Alert/);
  const click=handler('app/caregiver/communication-cards.tsx','handleCardClick',{
    Alert:AppAlert,t:{prompt:'提示',notRecorded:'尚未錄音'},
    player:{play(){assert.fail('Must not play')}},
  });
  for(const task of [{hasRecording:false},{hasRecording:true,audioUrl:''},{hasRecording:true,audioUrl:'  '}])await click(task);
  assert.deepEqual(messages,Array(3).fill('提示\n\n尚未錄音'));
});
test('web confirmation bridge cancels without invoking deletion and confirms exactly once',()=>{
  let deleted=0,accepted=false;
  const {AppAlert}=compile(read('src/ui/AppAlert.web.ts'),{window:{confirm:()=>accepted}});
  const buttons=[{style:'cancel'},{style:'destructive',onPress:()=>deleted++}];
  AppAlert.alert('刪除行程','確定？',buttons);assert.equal(deleted,0);
  accepted=true;AppAlert.alert('刪除行程','確定？',buttons);assert.equal(deleted,1);
});

test('OCR and translation: timeout, cancellation, retry and safe errors',async()=>{
  const api=compile(read('src/api/analyzePrescription.ts'),{process:{env:{EXPO_PUBLIC_PRESCRIPTION_API_BASE_URL:'https://example.invalid'}},require:()=>({__esModule:true,default:{expoConfig:{extra:{}}}})});
  const saved=global.fetch;
  try {
    for(const service of ['ocr','translation']) {
      let receivedSignal;
      global.fetch=(_url,options)=>{receivedSignal=options.signal;return new Promise(()=>{});};
      await assert.rejects(api.requestServiceJson('https://example.invalid',{},service,10),{code:service+'/timeout'});
      assert.equal(receivedSignal.aborted,true);
      global.fetch=async(_url,options)=>{receivedSignal=options.signal;return{ok:true,text:()=>new Promise(()=>{})};};
      await assert.rejects(api.requestServiceJson('https://example.invalid',{},service,10),{code:service+'/timeout'});
      assert.equal(receivedSignal.aborted,true);
    }
    const cancelled=new AbortController();cancelled.abort();let calls=0;
    global.fetch=async()=>{calls++;return{ok:true,text:async()=>'{}'}};
    await assert.rejects(api.requestServiceJson('https://example.invalid',{},'translation',100,cancelled.signal),{code:'translation/cancelled'});
    assert.equal(calls,0);
    const active=new AbortController();
    global.fetch=()=>new Promise(()=>{});
    const pending=api.requestServiceJson('https://example.invalid',{},'translation',100,active.signal);
    active.abort();await assert.rejects(pending,{code:'translation/cancelled'});
    global.fetch=async()=>({ok:true,text:async()=>JSON.stringify({medicines:[]})});
    assert.deepEqual(await api.analyzePrescriptionByUrl('synthetic-image'),{medicines:[]});
    global.fetch=async()=>({ok:false,status:500,text:async()=>'<html>private details</html>'});
    await assert.rejects(api.translateText('hello'),e=>e.code==='translation/unavailable'&&!/private|html|500/.test(e.message));
    global.fetch=async()=>({ok:true,text:async()=>JSON.stringify({translated_text:'你好'})});
    assert.equal((await api.translateText('hello')).translated_text,'你好');
    for (const result of [null,{}, {translations:[]}, {translations:[{key:'a',translated_text:''}]}]) {
      global.fetch=async()=>({ok:true,text:async()=>JSON.stringify(result)});
      await assert.rejects(api.translateTexts([{key:'a',text:'hello'}],'Chinese'),{code:'translation/recognition'});
    }
    global.fetch=async()=>({ok:true,text:async()=>JSON.stringify({translations:[{key:'a',translated_text:'你好'}]})});
    assert.equal((await api.translateTexts([{key:'a',text:'hello'}],'Chinese')).translations[0].translated_text,'你好');
  } finally {global.fetch=saved;}
});
