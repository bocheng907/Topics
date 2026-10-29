const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const project='demo-handbook-release', host='127.0.0.1:18498';
if(process.env.FIRESTORE_EMULATOR_HOST!==host || process.env.GCLOUD_PROJECT!==project) throw Error('Dedicated emulator required');
const prefix=`projects/${project}/databases/(default)/documents`, base=`http://${host}/v1/${prefix}`;
const keys=['dailyRoutine','medicationNotes','dietNotes','mobilityNotes','hygieneNotes','sleepNotes','communicationNotes','emergencyNotes','otherNotes'];
let serial=0;
function token(uid){const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');return `${enc({alg:'none',typ:'JWT'})}.${enc({sub:uid,user_id:uid,aud:project,iss:`https://securetoken.google.com/${project}`,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,firebase:{sign_in_provider:'password'}})}.`;}
function val(v){if(v===null)return {nullValue:null};if(v instanceof Date)return {timestampValue:v.toISOString()};if(Array.isArray(v))return {arrayValue:{values:v.map(val)}};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return {integerValue:String(v)};if(typeof v==='object')return {mapValue:{fields:fields(v)}};return {stringValue:v};}
function fields(d){return Object.fromEntries(Object.entries(d).map(([k,v])=>[k,val(v)]));}
async function req(url,uid,body,method='POST'){const r=await fetch(url,{method,headers:{'Content-Type':'application/json',...(uid?{Authorization:`Bearer ${uid==='ADMIN'?'owner':token(uid)}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.text()};}
async function expect(p,status){const r=await p;assert.equal(r.status,status,r.body);}
async function fixture(){const id=`handbook_${process.pid}_${++serial}`,f=id+'_f',b=id+'_b',c=id+'_c',o=id+'_other';const p=`patients/${id}`,h=p+'/care_handbook/main';await expect(req(base+'/'+p,'ADMIN',{fields:fields({families:[f,b],caregivers:[c],primaryFamilyUid:f,createdBy:f})},'PATCH'),200);return {id,f,b,c,o,p,h};}
function data(x,uid=x.f){return {patientId:x.id,updatedBy:uid,updatedAt:new Date(),...Object.fromEntries(keys.map(k=>[k,'照護交接']))};}
function write(x,uid,d=data(x,uid),transform=true,h=x.h){return req(base+':commit',uid,{writes:[{update:{name:prefix+'/'+h,fields:fields(d)},...(transform?{updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]}:{})}]});}
async function seed(x){await expect(req(base+'/'+x.h,'ADMIN',{fields:fields(data(x))},'PATCH'),200);}
test('isolated release changes nothing outside handbook block',()=>{const dir=path.join(__dirname,'../output/handbook-release-20261016');const read=f=>fs.readFileSync(path.join(dir,f),'utf8').replace(/\r\n/g,'\n');const block=read('handbook-block.rules');assert.equal(read('firestore.rules').replace(block,''),read('before.rules'));assert.ok(fs.readFileSync(path.join(__dirname,'../firestore.rules'),'utf8').replace(/\r\n/g,'\n').includes(block));});
for(const role of ['f','b'])test(role+' can create and update handbook',async()=>{const x=await fixture();await expect(write(x,x[role]),200);await expect(write(x,x[role],{...data(x,x[role]),dailyRoutine:'早餐後整理資料'}),200);});
for(const role of ['f','b','c'])test(role+' can read main',async()=>{const x=await fixture();await seed(x);await expect(req(base+'/'+x.h,x[role],null,'GET'),200);});
for(const role of ['c','o',null])for(const operation of ['create','update'])test(`${role} denied ${operation}`,async()=>{const x=await fixture();if(operation==='update')await seed(x);await expect(write(x,role?x[role]:null,data(x)),403);});
for(const role of ['o',null])test(`${role} denied read`,async()=>{const x=await fixture();await seed(x);await expect(req(base+'/'+x.h,role?x[role]:null,null,'GET'),403);});
for(const key of keys)for(const kind of ['too-long','wrong-type','missing'])test(`${key} rejects ${kind} on create AND update`,async()=>{const x=await fixture(),d=data(x);if(kind==='missing')delete d[key];else d[key]=kind==='too-long'?'字'.repeat(2001):[123];await expect(write(x,x.f,d),403);await seed(x);await expect(write(x,x.f,d),403);});
test('all sections accept exactly 2000 characters and empty strings',async()=>{const x=await fixture(),d=data(x);for(const k of keys)d[k]='字'.repeat(2000);await expect(write(x,x.f,d),200);for(const k of keys)d[k]='';await expect(write(x,x.f,d),200);});
for(const change of ['extra','patientId','updatedBy','timestamp','docId'])test('rejects spoofed '+change,async()=>{const x=await fixture(),d=data(x);if(change==='extra')d.admin=true;if(change==='patientId')d.patientId='elsewhere';if(change==='updatedBy')d.updatedBy=x.b;for(const existing of [false,true]){if(existing)await seed(x);await expect(write(x,x.f,d,change!=='timestamp',change==='docId'?x.p+'/care_handbook/other':x.h),403);}});
for(const role of ['f','b','c'])test(role+' cannot delete',async()=>{const x=await fixture();await seed(x);await expect(req(base+'/'+x.h,x[role],null,'DELETE'),403);});
test('revoked family cannot read or write',async()=>{const x=await fixture();await seed(x);await expect(req(base+'/'+x.p,'ADMIN',{fields:fields({families:[x.b],caregivers:[x.c]})},'PATCH'),200);await expect(req(base+'/'+x.h,x.f,null,'GET'),403);await expect(write(x,x.f),403);});
test('pending deletion denies read and write',async()=>{const x=await fixture();await seed(x);await expect(req(base+'/_account_deletions/'+x.f,'ADMIN',{fields:fields({status:'pending'})},'PATCH'),200);await expect(req(base+'/'+x.h,x.f,null,'GET'),403);await expect(write(x,x.f),403);});
test('orphan handbook is unreadable and unwritable',async()=>{const x=await fixture();await seed(x);await expect(req(base+'/'+x.p,'ADMIN',null,'DELETE'),200);await expect(req(base+'/'+x.h,x.f,null,'GET'),403);await expect(write(x,x.f),403);});
test('same user cannot access unrelated patient handbook',async()=>{const x=await fixture(),y=await fixture();await seed(y);await expect(req(base+'/'+y.h,x.f,null,'GET'),403);await expect(write(y,x.f),403);});
test('cannot enumerate handbooks across patients',async()=>{const x=await fixture();await seed(x);await expect(req(base+':runQuery',x.f,{structuredQuery:{from:[{collectionId:'care_handbook',allDescendants:true}]}}),403);});
