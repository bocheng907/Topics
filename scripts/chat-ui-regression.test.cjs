const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');

for (const role of ['family','caregiver']) {
  const source=fs.readFileSync(require.resolve(`../app/${role}/chat-room.tsx`),'utf8');
  const file=ts.createSourceFile('chat.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const calls=[];
  function visit(n){if(ts.isCallExpression(n))calls.push(n);ts.forEachChild(n,visit);}
  visit(file);
  test(`${role}: photo upload awaits both storage and message writes`, () => {
    const start = source.indexOf('const uploadImage = async');
    const upload = source.slice(start, source.indexOf('const sendMessage = async', start));
    assert.match(upload, /const snapshot = await uploadTask/);
    assert.doesNotMatch(upload, /uploadTask\.on\(/);
    assert.match(upload, /await setDoc/);
    assert.match(upload, /copy.photoFailed/);
    assert.match(upload, /finally\s*\{\s*uploadLock.current = false;\s*setUploading\(false\)/);
  });
  const subscription=calls.find(n=>n.expression.getText(file)==='useEffect'&&n.arguments[0].getText(file).includes('const unsubscribe = onSnapshot'));
  test(`${role}: conversation subscription restarts for identity, room and retry`,()=>{
    assert.ok(subscription);
    assert.equal(subscription.arguments[1].getText(file),'[targetId, messageCollection, user?.uid, retry]');
  });
  function mount(user){
    const events=[],callbacks={};let cancelled=false;
    const run=new Function('targetId','user','db','messageCollection','query','collection','orderBy','onSnapshot','setMessages','setLoading','setLoadError','shouldScrollToEndRef',
      `return (${subscription.arguments[0].getText(file)})();`);
    const cleanup=run('patient',user,{},'messages',()=>({}),()=>({}),()=>({}),(_q,success,failure)=>{
      callbacks.success=success;callbacks.failure=failure;return()=>{cancelled=true;};
    },v=>events.push(['messages',v]),v=>events.push(['loading',v]),v=>events.push(['error',v]),{current:false});
    return {events,callbacks,cleanup,cancelled:()=>cancelled};
  }
  test(`${role}: no unauthenticated subscription; snapshot settles loading`,()=>{
    assert.equal(mount(null).callbacks.success,undefined);
    const f=mount({uid:'member'});
    f.callbacks.success({docs:[{id:'m',data:()=>({text:'Hello'})}]});
    assert.deepEqual(f.events,[['messages',[{id:'m',text:'Hello'}]],['loading',false],['error',false]]);
  });
  test(`${role}: cleanup ignores stale callbacks after account or room change`,()=>{
    const f=mount({uid:'member'});f.cleanup();f.callbacks.success({docs:[]});
    f.callbacks.failure(new Error('stale'));
    assert.equal(f.cancelled(),true);assert.deepEqual(f.events,[]);
  });
  test(`${role}: send is locked, errors retain draft, controls have names`,()=>{
    const start=source.indexOf('const sendMessage = async');
    const send=source.slice(start,source.indexOf('return (',start));
    assert.match(send,/sendLock\.current\) return/);
    assert.match(send,/sendLock\.current = true/);
    assert.match(send,/finally\s*\{\s*sendLock\.current = false/);
    assert.match(send,/currentScope\.current === scope/);
    assert.match(send,/copy.sendFailed/);
    assert.match(source,/accessibilityLabel=\{copy.send\}/);
    assert.match(source,/accessibilityLabel=\{copy.photo\}/);
    assert.match(source,/editable=\{!sending && !loading && !loadError && !!user && !!targetId\}/);
    assert.ok(!source.includes('  Alert,'),'Web-safe alert is used');
  });
}
