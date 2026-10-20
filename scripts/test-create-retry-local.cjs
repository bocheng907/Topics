const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18298' ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099') throw Error('Dedicated local emulators required');
const admin = require('../functions/node_modules/firebase-admin');
const app = admin.initializeApp({projectId:'demo-care-walkthrough'});
const db = app.firestore();
const service = require('../functions/careTargetAccess').createCareTargetService(db);
let passed = 0;
async function check(name, fn) { await fn(); console.log('PASS', ++passed, name); }
(async () => {
 const uid = 'retry-' + randomUUID();
 await db.doc('users/' + uid).set({uid, role:'family'});
 const request = {auth:{uid}, data:{name:'陳淑惠', notes:'下午由家人陪同散步。', requestId:randomUUID()}};
 let result;
 await check('concurrent retries commit one target', async () => {
   const responses = await Promise.all([service.createCareTarget(request), service.createCareTarget(request)]);
   assert.deepEqual(responses[0], responses[1]); result = responses[0];
   assert.equal((await db.collection('patients').where('families','array-contains',uid).get()).size,1);
 });
 await check('lost response replay returns original', async()=>assert.deepEqual(await service.createCareTarget(request),result));
 await check('retry does not consume create quota', async()=>assert.equal((await db.doc(`users/${uid}/_care_target_limits/create`).get()).data().count,1));
 await check('changed payload rejected', async()=>assert.rejects(service.createCareTarget({...request,data:{...request.data,name:'另一位'}}),{code:'failed-precondition'}));
 await check('invalid request ID rejected', async()=>assert.rejects(service.createCareTarget({...request,data:{...request.data,requestId:'../bad'}}),{code:'invalid-argument'}));
 await check('anonymous denied', async()=>assert.rejects(service.createCareTarget({data:request.data}),{code:'unauthenticated'}));
 await check('caregiver denied', async()=>{
   await db.doc('users/'+uid).update({role:'caregiver'});
   await assert.rejects(service.createCareTarget(request),{code:'permission-denied'});
   await db.doc('users/'+uid).update({role:'family'});
 });
 await check('pending deletion cannot replay', async()=>{
   await db.doc('_account_deletions/'+uid).set({status:'pending'});
   await assert.rejects(service.createCareTarget(request),{code:'permission-denied'});
   await db.doc('_account_deletions/'+uid).delete();
 });
 await check('request IDs are scoped to the authenticated user', async()=>{
   const other='retry-'+randomUUID();await db.doc('users/'+other).set({uid:other,role:'family'});
   const second=await service.createCareTarget({...request,auth:{uid:other}});
   assert.notEqual(second.patientId,result.patientId);
 });
 await check('quota blocks new requests but permits recovery', async()=>{
   await db.doc(`users/${uid}/_care_target_limits/create`).set({start:Date.now(),count:10});
   assert.deepEqual(await service.createCareTarget(request),result);
   await assert.rejects(service.createCareTarget({...request,data:{...request.data,requestId:randomUUID()}}),{code:'resource-exhausted'});
 });
 await check('deleted target not recreated by replay', async()=>{
   await db.doc('patients/'+result.patientId).delete();
   await assert.rejects(service.createCareTarget(request),{code:'permission-denied'});
   assert.equal((await db.collection('patients').where('families','array-contains',uid).get()).size,0);
 });
 // Fresh isolated UI fixtures, never existing production or demo accounts.
 if(process.argv.includes('--tests-only')) {console.log('TOTAL',passed);return;}
 for (const [key,role,displayName] of [['family','family','陳雅婷'],['caregiver','caregiver','林怡君']]) {
   const id = 'three-fixes-'+key;
   try { await app.auth().getUser(id); }
   catch { await app.auth().createUser({uid:id,email:`${key}.fixes@care.example`,password:'LocalCare2026!',displayName}); }
   await db.doc('users/'+id).set({uid:id,role,displayName,email:`${key}.fixes@care.example`,emergencyPhone1:'0000000000',emergencyPhone2:'0000000000',createdAt:admin.firestore.Timestamp.now(),accountStatus:'active',activePatientId:'three-fixes-patient',privacyConsent:{accepted:true,version:'2026-09-22.v2',acceptedAt:admin.firestore.Timestamp.now()}});
 }
 await db.doc('patients/three-fixes-patient').set({name:'陳建國',families:['three-fixes-family'],caregivers:['three-fixes-caregiver'],primaryFamilyUid:'three-fixes-family',createdAt:admin.firestore.Timestamp.now()});
 for (let i=0;i<3;i++) await db.doc('health_records/three-fixes-'+i).set({patientId:'three-fixes-patient',caregiverId:'three-fixes-caregiver',temperature:36.5+i/10,heartRate:75+i,bloodPressureSys:120+i,bloodPressureDia:78+i,bloodSugar:95+i,createdAt:admin.firestore.Timestamp.fromMillis(Date.now()-i*86400000)});
 console.log('TOTAL',passed,'UI fixtures ready');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>app.delete());
