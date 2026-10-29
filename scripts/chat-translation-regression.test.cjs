const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const path=require('node:path');
const file=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const scope={exports:{}};
vm.runInNewContext(ts.transpileModule(file('src/chat/chatTranslation.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,scope);
const {originalChatText,chatTranslationKey,savedChatTranslation,chatLocales}=scope.exports;
test('translation does not mistake old foreign text_zh for a Chinese translation',()=>{
  assert.equal(savedChatTranslation({id:'1',text:'Hello',text_zh:'Hello'},'zh'),'');
  assert.equal(savedChatTranslation({id:'1',text:'Hello',text_zh:'你好'},'zh'),'你好');
});
test('translation cache separates message identity, source edits and target language',()=>{
  const m={id:'1',text:'hello'};
  assert.notEqual(chatTranslationKey(m,'en'),chatTranslationKey(m,'id'));
  assert.notEqual(chatTranslationKey(m,'en'),chatTranslationKey({...m,id:'2'},'en'));
  assert.notEqual(chatTranslationKey(m,'en'),chatTranslationKey({...m,text:'changed'},'en'));
});
test('original remains available and existing translations are reusable',()=>{
  const m={id:'1',text:'hello',text_original:'original',text_id:'Halo'};
  assert.equal(originalChatText(m),'original');
  assert.equal(savedChatTranslation(m,'id'),'Halo');
  assert.equal(savedChatTranslation(m,'vi'),'');
  assert.equal(Object.keys(chatLocales).length,4);
});
for(const role of ['family','caregiver']){
  test(role+': room and preview translate; no false Chinese field on send',()=>{
    const room=file('app/'+role+'/chat-room.tsx');
    const list=file('app/'+role+'/chat-list.tsx');
    assert.match(room,/useChatTranslation\(messages, language, chatScope\)/);
    assert.match(list,/useChatTranslation\(/);
    assert.match(room,/<ChatTranslationStatus/);
    assert.match(list,/<ChatTranslationStatus/);
    assert.doesNotMatch(room,/text_zh: inputText/);
    assert.doesNotMatch(room,/maxWidth: "82%"|maxWidth: "92%"/);
    assert.ok(room.indexOf('<ScreenHeader')<room.indexOf('<KeyboardAvoidingView'));
  });
}
