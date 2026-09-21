const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const req=require('node:module').createRequire(require('node:path').join(__dirname,'../functions/package.json'));
const {initializeApp,deleteApp}=req('firebase-admin/app');
const {getFirestore,Timestamp}=req('firebase-admin/firestore');
const {createAccountDeletionService}=require('../functions/accountDeletion');
const {createPersonalDataExportService}=require('../functions/personalDataExport');
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8198')throw Error('Local emulator only');
const project='demo-invite-expiry',app=initializeApp({projectId:project},'extended-'+randomUUID()),db=getFirestore(app);
const base='http://127.0.0.1:8198/v1/projects/'+project+'/databases/(default)/documents';
after(async()=>{await db.terminate();await deleteApp(app);});
function token(uid,claims={}){const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');return enc({alg:'none',typ:'JWT'})+'.'+enc({sub:uid,user_id:uid,aud:project,iss:'https://securetoken.google.com/'+project,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,firebase:{sign_in_provider:'password'},...claims})+'.';}
async function rest(path,uid,method='GET',data,claims={}){
 const headers={'Content-Type':'application/json',...(uid?{Authorization:'Bearer '+token(uid,claims)}:{})};
 const fields=data?Object.fromEntries(Object.entries(data).map(([k,v])=>[k,{stringValue:v}])):null;
 const url=method==='PATCH'?base+':commit':base+'/'+path;
 const body=method==='PATCH'?{writes:[{update:{name:'projects/'+project+'/databases/(default)/documents/'+path,fields},
   updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]}]}:null;
 const r=await fetch(url,{method:method==='PATCH'?'POST':method,headers,...(body?{body:JSON.stringify(body)}:{})});await r.text();return r.status;
}
async function fixture(){const id=randomUUID(),owner='owner-'+id,care='care-'+id,patient='patient-'+id;for(const [uid,role]of [[owner,'family'],[care,'caregiver']])await db.doc('users/'+uid).set({uid,role});await db.doc('patients/'+patient).set({families:[owner],caregivers:[care],createdBy:owner,primaryFamilyUid:owner});return {owner,care,patient};}
test('two linked identities exchange messages and export populated own records',async()=>{
 const f=await fixture(),prefix='chats/'+f.patient+'/messages/';
 assert.equal(await rest(prefix+'a',f.owner,'PATCH',{senderId:f.owner,text:'TEST_OWNER'}),200);
 assert.equal(await rest(prefix+'b',f.care,'PATCH',{senderId:f.care,text:'TEST_CARE'}),200);
 assert.equal(await rest(prefix+'a',f.care),200);assert.equal(await rest(prefix+'b',f.owner),200);assert.equal(await rest(prefix+'a','outsider'),403);
 await db.doc('prescriptions/'+f.patient).set({patientId:f.patient,createdBy:f.owner,title:'TEST_RX',createdAt:Timestamp.now()});
 await db.doc('prescriptions/'+f.patient+'/items/a').set({drug_name:'TEST_DRUG',dose:'1'});
 await db.doc('health_records/'+f.patient).set({patientId:f.patient,caregiverId:f.care,temperature:36.5,createdAt:Timestamp.now()});
 const service=createPersonalDataExportService({db});
 for(const [uid,mine,other]of [[f.owner,'TEST_OWNER','TEST_CARE'],[f.care,'TEST_CARE','TEST_OWNER']]){const r=await service({auth:{uid,token:{auth_time:Math.floor(Date.now()/1000)}},data:{}});assert.ok(r.json.includes(mine));assert.ok(!r.json.includes(other));assert.equal(r.counts.prescriptions,uid===f.owner?1:0);assert.equal(r.counts.health_records,uid===f.care?1:0);}
});
test('chat sender spoofing must be rejected',async()=>{const f=await fixture();assert.equal(await rest('chats/'+f.patient+'/messages/forged',f.care,'PATCH',{senderId:f.owner,text:'FORGED_TEST'}),403);});
test('chat member must not overwrite another sender message',async()=>{const f=await fixture(),path='chats/'+f.patient+'/messages/a';await rest(path,f.owner,'PATCH',{senderId:f.owner,text:'ORIGINAL_TEST'});assert.equal(await rest(path,f.care,'PATCH',{senderId:f.owner,text:'ALTERED_TEST'}),403);});
test('chat rejects updates, deletion, invalid schema and unlinked writes; accepts image',async()=>{
 const f=await fixture(),p='chats/'+f.patient+'/messages/';
 assert.equal(await rest(p+'image',f.owner,'PATCH',{senderId:f.owner,imageUrl:'https://example.invalid/test.jpg'}),200);
 assert.equal(await rest(p+'image',f.owner,'PATCH',{senderId:f.owner,text:'replacement'}),403);
 assert.equal(await rest(p+'image',f.owner,'DELETE'),403);
 assert.equal(await rest(p+'image',f.care,'DELETE'),403);
 for(const [name,data]of [['empty',{text:''}],['oversize',{text:'x'.repeat(10001)}],
   ['extra',{text:'test',admin:'true'}],['both',{text:'test',imageUrl:'https://example.invalid/a'}]])
   assert.equal(await rest(p+name,f.owner,'PATCH',{senderId:f.owner,...data}),403);
 assert.equal(await rest(p+'outsider','outsider','PATCH',{senderId:'outsider',text:'test'}),403);
 assert.equal(await rest(p+'anonymous',null,'PATCH',{senderId:f.owner,text:'test'}),403);
 assert.equal(await rest('chats/'+f.patient+'/other/x',f.owner,'PATCH',{senderId:f.owner,text:'test'}),403);
});
test('audit admin reads, ordinary and anonymous denied, admin cannot modify logs',async()=>{const f=await fixture(),path='audit_logs/'+f.patient;await db.doc(path).set({operation:'test',createdAt:Timestamp.now()});assert.equal(await rest(path,f.owner),403);assert.equal(await rest(path,null),403);assert.equal(await rest(path,f.owner,'GET',null,{auditAdmin:true}),200);assert.equal(await rest(path,f.owner,'PATCH',{operation:'forged'},{auditAdmin:true}),403);assert.equal(await rest(path,f.owner,'DELETE',null,{auditAdmin:true}),403);});
test('deletion cancellation, 30-day boundary and shared-member preservation',async()=>{
 const f=await fixture();let time=new Date('2030-01-01T00:00:00Z');const deleted=[];
 const service=createAccountDeletionService({db,now:()=>time,auth:{deleteUser:async uid=>deleted.push(uid)},bucket:{name:'test.invalid',file:()=>({delete:async()=>{}}),deleteFiles:async()=>{}}});
 const request=()=>({auth:{uid:f.owner,token:{auth_time:Math.floor(time.getTime()/1000)}}});
 await service.requestAccountDeletion(request());assert.equal((await db.doc('_account_deletions/'+f.owner).get()).data().scheduledFor.toDate().toISOString(),'2030-01-31T00:00:00.000Z');
 await service.cancelAccountDeletion(request());assert.equal((await db.doc('_account_deletions/'+f.owner).get()).exists,false);
 await service.requestAccountDeletion(request());const rx='delete-'+f.patient;
 await db.doc('prescriptions/'+rx).set({patientId:f.patient,createdBy:f.owner});await db.doc('prescriptions/'+rx+'/items/a').set({drug_name:'TEST'});await db.doc('medication_reminders/'+rx).set({patientId:f.patient,prescriptionId:rx});
 await db.doc('health_records/'+rx).set({patientId:f.patient,caregiverId:f.care,temperature:36.5});await db.doc('chats/'+f.patient+'/messages/owner').set({senderId:f.owner,text:'DELETE_ME'});await db.doc('chats/'+f.patient+'/messages/care').set({senderId:f.care,text:'KEEP_ME'});
 time=new Date('2030-01-30T23:59:59.999Z');await service.purgeDueAccounts();assert.ok((await db.doc('users/'+f.owner).get()).exists);assert.equal(deleted.includes(f.owner),false);
 time=new Date('2030-01-31T00:00:00Z');await assert.rejects(service.cancelAccountDeletion(request()),{code:'failed-precondition'});const r=await service.purgeDueAccounts();assert.equal(r.failed,0);
 for(const path of ['users/'+f.owner,'_account_deletions/'+f.owner,'prescriptions/'+rx,'prescriptions/'+rx+'/items/a','medication_reminders/'+rx,'chats/'+f.patient+'/messages/owner'])assert.equal((await db.doc(path).get()).exists,false,path);
 assert.ok((await db.doc('health_records/'+rx).get()).exists);assert.ok((await db.doc('chats/'+f.patient+'/messages/care').get()).exists);const p=(await db.doc('patients/'+f.patient).get()).data();assert.deepEqual(p.families,[]);assert.deepEqual(p.caregivers,[f.care]);assert.equal(p.primaryFamilyUid,'');assert.ok(deleted.includes(f.owner));
});
