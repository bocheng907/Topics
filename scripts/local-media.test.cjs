const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync(require.resolve('../src/media/readLocalBlob.ts'),'utf8');
function reader({status=0,event='load',body={size:8}}={}) {
  let request;
  class XHR {
    constructor(){ request=this; this.status=status; this.response=body; }
    open(method,uri,async){Object.assign(this,{method,uri,async});}
    send(value){this.value=value; this['on'+event]();}
  }
  const context={exports:{},XMLHttpRequest:XHR};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
  return {read:context.exports.readLocalBlob,request:()=>request};
}
for(const uri of ['file:///recording.m4a','content://picker/image','blob:http://localhost/image']) test('local media '+uri,async()=>{
  const r=reader(); assert.equal((await r.read(uri)).size,8);
  assert.deepEqual([r.request().method,r.request().uri,r.request().responseType,r.request().timeout],['GET',uri,'blob',30000]);
});
for(const event of ['error','abort','timeout'])test('reject '+event,async()=>{await assert.rejects(reader({event}).read('file:///x'));});
test('reject HTTP error and missing blob',async()=>{
  await assert.rejects(reader({status:404}).read('https://example.invalid/x'));
  await assert.rejects(reader({body:null}).read('file:///missing'));
});
test('accept successful web blob',async()=>{assert.equal((await reader({status:200}).read('blob:x')).size,8);});
