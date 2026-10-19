const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const sdk = require('firebase/firestore');
const {initializeApp,deleteApp} = require('firebase/app');
const {getAuth,connectAuthEmulator,signInWithEmailAndPassword} = require('firebase/auth');
const admin = require('../functions/node_modules/firebase-admin');
const project = 'demo-care-walkthrough';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18298' ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099' || process.env.GCLOUD_PROJECT !== project) throw Error('Isolated emulators required');
const adminApp = admin.initializeApp({projectId:project},'reliability');
const adb = adminApp.firestore();
const file = path.resolve(__dirname,'../src/care-target/reliableWrites.ts');
const mod = new Module(file,module); mod.filename=file; mod.paths=Module._nodeModulePaths(path.dirname(file));
mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {publishHandbook,acknowledgeHandbook,handbookForm,legacyVersion,saveHealthOnce} = mod.exports;
const clients=[];
let actors;
async function actor(role) {
  const uid=randomUUID(), email=`${uid}@example.invalid`, password='LocalOnly-'+randomUUID();
  await adminApp.auth().createUser({uid,email,password});
  const app=initializeApp({projectId:project,apiKey:'local-only',appId:uid},uid);
  const auth=getAuth(app); connectAuthEmulator(auth,'http://127.0.0.1:19099',{disableWarnings:true});
  await signInWithEmailAndPassword(auth,email,password);
  const db=sdk.getFirestore(app); sdk.connectFirestoreEmulator(db,'127.0.0.1',18298);
  clients.push(app); return {uid,db,role};
}
async function fixture() {
  actors ??= Promise.all([actor('family'),actor('family'),actor('caregiver'),actor('outsider')]);
  const [f,b,c,o]=await actors, id=randomUUID();
  await adb.doc(`patients/${id}`).set({families:[f.uid,b.uid],caregivers:[c.uid],primaryFamilyUid:f.uid,name:'陳建國'});
  return {f,b,c,o,id,ref:`patients/${id}/care_handbook/main`,form:{...handbookForm(),dailyRoutine:'早餐後一起散步，下午整理回診資料。'}};
}
async function publish(x,actor=x.f) {
  const rev=randomUUID(); await publishHandbook(actor.db,x.id,actor.uid,x.form,'',legacyVersion(undefined),rev); return rev;
}
const denied = p => assert.rejects(p, e=>e.code==='permission-denied');
function ack(x,uid,revision){return {patientId:x.id,caregiverUid:uid,revision,acknowledgedAt:sdk.serverTimestamp()};}
function main(x,uid,revision,baseRevision=''){return {...x.form,patientId:x.id,updatedBy:uid,updatedAt:sdk.serverTimestamp(),revision,baseRevision};}
function writeMain(x, actor, data) {
  const batch=sdk.writeBatch(actor.db);
  batch.set(sdk.doc(actor.db,`patients/${x.id}/care_handbook_revisions/${data.revision}`),{createdAt:sdk.serverTimestamp()});
  batch.set(sdk.doc(actor.db,x.ref),data);
  return batch.commit();
}
test('two concurrent family saves: one winner and one conflict, no silent overwrite',async()=>{
  const x=await fixture(), ids=[randomUUID(),randomUUID()];
  const results=await Promise.allSettled([publishHandbook(x.f.db,x.id,x.f.uid,x.form,'',legacyVersion(undefined),ids[0]),
    publishHandbook(x.b.db,x.id,x.b.uid,{...x.form,dietNotes:'午餐準備軟飯。'},'',legacyVersion(undefined),ids[1])]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'care/conflict');
});
test('legacy handbook migrates and changed legacy content rejects stale draft',async()=>{
  const x=await fixture(), old={...x.form,patientId:x.id,updatedBy:x.f.uid,updatedAt:admin.firestore.Timestamp.now()};
  await adb.doc(x.ref).set(old);
  const snap=await sdk.getDocFromServer(sdk.doc(x.f.db,x.ref));
  await adb.doc(x.ref).update({dietNotes:'午餐已更新'});
  await assert.rejects(publishHandbook(x.f.db,x.id,x.f.uid,x.form,'',legacyVersion(snap.data()),randomUUID()),{code:'care/conflict'});
  const latest=await sdk.getDocFromServer(sdk.doc(x.f.db,x.ref));
  await publishHandbook(x.f.db,x.id,x.f.uid,handbookForm(latest.data()),'',legacyVersion(latest.data()),randomUUID());
});
test('same publish ID retry is a no-op, older version cannot overwrite newer',async()=>{
  const x=await fixture(), r=await publish(x);
  await publishHandbook(x.f.db,x.id,x.f.uid,x.form,'',legacyVersion(undefined),r);
  const r2=randomUUID(); await publishHandbook(x.b.db,x.id,x.b.uid,x.form,r,'',r2);
  await assert.rejects(publishHandbook(x.f.db,x.id,x.f.uid,x.form,'',legacyVersion(undefined),r),{code:'care/conflict'});
});
test('acknowledgment ties UID/server time to exact revision and repeat does not change time',async()=>{
  const x=await fixture(), r=await publish(x), a=`${x.ref}/acknowledgments/${x.c.uid}`;
  await acknowledgeHandbook(x.c.db,x.id,x.c.uid,r);
  const first=(await adb.doc(a).get()).data(); assert.equal(first.caregiverUid,x.c.uid); assert.equal(first.revision,r);
  assert.ok(first.acknowledgedAt.toMillis());
  await acknowledgeHandbook(x.c.db,x.id,x.c.uid,r);
  assert.equal((await adb.doc(a).get()).data().acknowledgedAt.toMillis(),first.acknowledgedAt.toMillis());
  const r2=randomUUID(); await publishHandbook(x.f.db,x.id,x.f.uid,x.form,r,'',r2);
  await assert.rejects(acknowledgeHandbook(x.c.db,x.id,x.c.uid,r),{code:'care/conflict'});
  await acknowledgeHandbook(x.c.db,x.id,x.c.uid,r2);
  assert.equal((await adb.doc(a).get()).data().revision,r2);
});
for(const role of ['f','b','c']) test(`${role} can list scoped acknowledgments`,async()=>{
  const x=await fixture(); await publish(x);
  await sdk.getDocs(sdk.collection(x[role].db,x.ref,'acknowledgments'));
});
for(const role of ['f','b','o']) test(`${role} cannot acknowledge as caregiver`,async()=>{
  const x=await fixture(), r=await publish(x);
  await denied(sdk.setDoc(sdk.doc(x[role].db,x.ref,'acknowledgments',x.c.uid),ack(x,x.c.uid,r)));
});
for(const role of ['c','o']) test(`${role} cannot publish handbook`,async()=>{
  const x=await fixture(); await denied(writeMain(x,x[role],main(x,x[role].uid,randomUUID())));
});
for(const change of ['other-uid','other-patient','old-revision','extra-field','missing-field','forged-time','wrong-type','huge-revision']) {
  test(`ack rejects ${change} on create and update`,async()=>{
    const x=await fixture(), r=await publish(x), a=`${x.ref}/acknowledgments/${x.c.uid}`;
    for(const exists of [false,true]) {
      if(exists) await adb.doc(a).set({patientId:x.id,caregiverUid:x.c.uid,revision:randomUUID(),acknowledgedAt:admin.firestore.Timestamp.now()});
      const d=ack(x,x.c.uid,r);
      if(change==='other-uid')d.caregiverUid=x.f.uid;
      if(change==='other-patient')d.patientId='elsewhere';
      if(change==='old-revision')d.revision=randomUUID();
      if(change==='extra-field')d.role='admin';
      if(change==='missing-field')delete d.patientId;
      if(change==='forged-time')d.acknowledgedAt=sdk.Timestamp.fromMillis(0);
      if(change==='wrong-type')d.revision=7;
      if(change==='huge-revision')d.revision='a'.repeat(10000);
      await denied(sdk.setDoc(sdk.doc(x.c.db,a),d));
    }
  });
}
for(const key of Object.keys(handbookForm())) for(const value of [9000,'x'.repeat(2001),null]) test(`handbook ${key} rejects ${value===null?'null':typeof value==='number'?'number':'oversize'} create/update`,async()=>{
  const x=await fixture(); const r=randomUUID();
  await denied(writeMain(x,x.f,{...main(x,x.f.uid,r),[key]:value}));
  const prev=await publish(x);
  await denied(writeMain(x,x.f,{...main(x,x.f.uid,r,prev),[key]:value}));
});
test('handbook extra/missing fields, old client, stale base, spoofed author/time, wrong ID rejected',async()=>{
  const x=await fixture(), r=await publish(x);
  const good=main(x,x.f.uid,randomUUID(),r);
  for(const bad of [{...good,extra:true},{...good,baseRevision:''},{...good,updatedBy:x.b.uid},
    {...good,updatedAt:sdk.Timestamp.fromMillis(0)},Object.fromEntries(Object.entries(good).filter(([k])=>k!=='dailyRoutine')),
    Object.fromEntries(Object.entries(good).filter(([k])=>!['revision','baseRevision'].includes(k)))])
    await denied(writeMain(x,x.f,bad));
  await denied(sdk.setDoc(sdk.doc(x.f.db,`patients/${x.id}/care_handbook/other`),main(x,x.f.uid,randomUUID())));
});
test('cannot overwrite same-version acknowledgment or delete it',async()=>{
  const x=await fixture(),r=await publish(x),a=sdk.doc(x.c.db,x.ref,'acknowledgments',x.c.uid);
  await acknowledgeHandbook(x.c.db,x.id,x.c.uid,r);
  await denied(sdk.setDoc(a,ack(x,x.c.uid,r))); await denied(sdk.deleteDoc(a));
});
test('cannot recycle old revision UUID, forge marker, or create unpaired marker',async()=>{
  const x=await fixture(),r=await publish(x),r2=randomUUID();
  await publishHandbook(x.f.db,x.id,x.f.uid,x.form,r,'',r2);
  await denied(writeMain(x,x.f,main(x,x.f.uid,r,r2)));
  const marker=sdk.doc(x.f.db,`patients/${x.id}/care_handbook_revisions/${r}`);
  await denied(sdk.deleteDoc(marker));await denied(sdk.updateDoc(marker,{createdAt:sdk.serverTimestamp()}));
  await denied(sdk.setDoc(sdk.doc(x.f.db,`patients/${x.id}/care_handbook_revisions/${randomUUID()}`),{createdAt:sdk.serverTimestamp()}));
});
test('empty and maximum-size handbook fields accepted with valid fresh revision',async()=>{
  const x=await fixture();await writeMain(x,x.f,{...main(x,x.f.uid,randomUUID()),...handbookForm()});
  const prev=(await adb.doc(x.ref).get()).data().revision;
  await writeMain(x,x.f,{...main(x,x.f.uid,randomUUID(),prev),...Object.fromEntries(Object.keys(handbookForm()).map(k=>[k,'字'.repeat(2000)]))});
});
test('ack cannot use old version in a batch publishing a new version',async()=>{
  const x=await fixture(),r=await publish(x),r2=randomUUID();
  // A dual-role fixture exercises getAfter rather than relying solely on role denial.
  await adb.doc(`patients/${x.id}`).update({caregivers:[x.c.uid,x.f.uid]});
  const batch=sdk.writeBatch(x.f.db);
  batch.set(sdk.doc(x.f.db,x.ref),main(x,x.f.uid,r2,r));
  batch.set(sdk.doc(x.f.db,`patients/${x.id}/care_handbook_revisions/${r2}`),{createdAt:sdk.serverTimestamp()});
  batch.set(sdk.doc(x.f.db,x.ref,'acknowledgments',x.f.uid),ack(x,x.f.uid,r));
  await denied(batch.commit());
});
test('outsider, revoked member, pending deletion and missing parent cannot access acknowledgments',async()=>{
  const x=await fixture(),r=await publish(x),a=`${x.ref}/acknowledgments/${x.c.uid}`;
  await acknowledgeHandbook(x.c.db,x.id,x.c.uid,r);
  await denied(sdk.getDocFromServer(sdk.doc(x.o.db,a)));
  await denied(sdk.getDocs(sdk.collection(x.o.db,x.ref,'acknowledgments')));
  await adb.doc(`_account_deletions/${x.c.uid}`).set({status:'pending'});
  await denied(sdk.getDocFromServer(sdk.doc(x.c.db,a)));
  await adb.doc(`_account_deletions/${x.c.uid}`).delete();
  await adb.doc(`patients/${x.id}`).update({caregivers:[]});
  await denied(sdk.getDocFromServer(sdk.doc(x.c.db,a)));
  await denied(sdk.setDoc(sdk.doc(x.c.db,a),ack(x,x.c.uid,r)));
  await adb.doc(`patients/${x.id}`).delete();
  await denied(sdk.getDocFromServer(sdk.doc(x.f.db,a)));
});
test('cannot enumerate all acknowledgments or read/write without authentication',async()=>{
  const x=await fixture(),r=await publish(x);
  await denied(sdk.getDocs(sdk.collectionGroup(x.c.db,'acknowledgments')));
  const app=initializeApp({projectId:project,apiKey:'local-only'},randomUUID()); clients.push(app);
  const db=sdk.getFirestore(app); sdk.connectFirestoreEmulator(db,'127.0.0.1',18298);
  await denied(sdk.getDocFromServer(sdk.doc(db,x.ref)));
  await denied(sdk.setDoc(sdk.doc(db,x.ref,'acknowledgments',x.c.uid),ack(x,x.c.uid,r)));
});
test('health retry and simultaneous same-ID submission create exactly one unchanged record',async()=>{
  const x=await fixture(),id=randomUUID(),p={patientId:x.id,caregiverId:x.c.uid,temperature:36.6,heartRate:76};
  await Promise.all([saveHealthOnce(x.c.db,id,p),saveHealthOnce(x.c.db,id,p)]);
  const first=(await adb.doc(`health_records/${id}`).get()).data();
  await saveHealthOnce(x.c.db,id,p);
  assert.deepEqual((await adb.doc(`health_records/${id}`).get()).data(),first);
  assert.equal((await adb.collection('health_records').where('patientId','==',x.id).get()).size,1);
  await assert.rejects(saveHealthOnce(x.c.db,id,{...p,temperature:37.1}));
});
test('offline health and handbook save fail without writes; reconnect retry succeeds',async()=>{
  const x=await fixture(),id=randomUUID(),r=randomUUID(),p={patientId:x.id,caregiverId:x.c.uid,temperature:36.5};
  await sdk.disableNetwork(x.c.db); await sdk.disableNetwork(x.f.db);
  try {
    await assert.rejects(saveHealthOnce(x.c.db,id,p));
    await assert.rejects(publishHandbook(x.f.db,x.id,x.f.uid,x.form,'',legacyVersion(undefined),r));
    assert.equal((await adb.doc(`health_records/${id}`).get()).exists,false);
    assert.equal((await adb.doc(x.ref).get()).exists,false);
  } finally {await sdk.enableNetwork(x.c.db);await sdk.enableNetwork(x.f.db);}
  await saveHealthOnce(x.c.db,id,p); await publishHandbook(x.f.db,x.id,x.f.uid,x.form,'',legacyVersion(undefined),r);
});
after(async()=>{for(const app of clients)await deleteApp(app);await adminApp.delete();});
test('personal export contains only own currently accessible handover acknowledgment',async()=>{
  const x=await fixture(),r=await publish(x);
  await acknowledgeHandbook(x.c.db,x.id,x.c.uid,r);
  await adb.doc(`users/${x.c.uid}`).set({uid:x.c.uid,role:'caregiver'});
  await adb.doc(`${x.ref}/acknowledgments/${x.f.uid}`).set({patientId:x.id,caregiverUid:x.f.uid,revision:r,acknowledgedAt:admin.firestore.Timestamp.now()});
  const {createPersonalDataExportService}=require('../functions/personalDataExport');
  const run=createPersonalDataExportService({db:adb});
  const request={auth:{uid:x.c.uid,token:{auth_time:Math.floor(Date.now()/1000)}},data:{}};
  const result=JSON.parse((await run(request)).json);
  assert.ok(result.records.handover_acknowledgments.some(row=>row.data.patientId===x.id&&row.data.revision===r));
  assert.ok(result.records.handover_acknowledgments.every(row=>row.data.caregiverUid===x.c.uid));
  await adb.doc(`patients/${x.id}`).update({caregivers:[]});
  const after=JSON.parse((await run(request)).json);
  assert.ok(!(after.records.handover_acknowledgments||[]).some(row=>row.data.patientId===x.id));
});
test('30-day deletion removes departed caregiver acknowledgment, preserves others and handbook',async()=>{
  const departed=await actor('caregiver'),x=await fixture(),r=await publish(x);
  const own=adb.doc(`${x.ref}/acknowledgments/${departed.uid}`),other=adb.doc(`${x.ref}/acknowledgments/${x.c.uid}`);
  await own.set({patientId:x.id,caregiverUid:departed.uid,revision:r,acknowledgedAt:admin.firestore.Timestamp.now()});
  await acknowledgeHandbook(x.c.db,x.id,x.c.uid,r);
  await adb.doc(`users/${departed.uid}`).set({uid:departed.uid,role:'caregiver'});
  const before=(await mainSnapshot(x)).data();
  const {createAccountDeletionService}=require('../functions/accountDeletion');
  const service=createAccountDeletionService({db:adb,auth:adminApp.auth(),bucket:{deleteFiles:async()=>{},file:()=>({delete:async()=>{}})}});
  await service.requestAccountDeletion({auth:{uid:departed.uid,token:{auth_time:Math.floor(Date.now()/1000)}},data:{}});
  assert.equal((await service.purgeDueAccounts()).deleted,0);
  assert.equal((await own.get()).exists,true);
  await adb.doc(`_account_deletions/${departed.uid}`).update({scheduledFor:admin.firestore.Timestamp.fromMillis(Date.now()-1000)});
  const result=await service.purgeDueAccounts();assert.equal(result.failed,0);assert.equal(result.deleted,1);
  assert.equal((await own.get()).exists,false);assert.equal((await other.get()).exists,true);
  assert.deepEqual((await mainSnapshot(x)).data(),before);
  assert.equal((await adb.doc(`patients/${x.id}/care_handbook_revisions/${r}`).get()).exists,true);
});
function mainSnapshot(x){return adb.doc(x.ref).get();}
