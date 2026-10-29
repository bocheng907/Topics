const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const c=require('./showcase-common.cjs');
const {initializeApp,deleteApp}=require('firebase/app'),{getAuth,signInWithEmailAndPassword,signOut}=require('firebase/auth');
const {getFirestore,doc,getDoc,setDoc,serverTimestamp}=require('firebase/firestore');
async function main(){
 const s=c.state(),{db}=await c.admin(),checks=[];
 const check=(name,ok)=>{assert.ok(ok,name);checks.push({name,passed:true});};
 const reg=(await db.doc('_showcase_groups/'+s.id).get()).data(),stage=reg.postvisitStage;
 check('synthetic provenance and no simulated medication administration',reg.synthetic===true&&stage.clinicalEvent===false&&stage.medicationAdministrationRecorded===false);
 for(const p of stage.documentPaths)check('exists '+p,(await db.doc(p).get()).exists);
 const old=await db.doc('prescriptions/'+s.prescriptionId).get(),rx=await db.doc('prescriptions/'+stage.prescriptionId).get();
 check('old prescription remains unchanged',old.exists&&old.data().title==='10月門診用藥');
 check('new prescription belongs to exact showcase patient',rx.data().patientId===s.patientId);
 for(const id of ['item-01','item-02']){const before=(await old.ref.collection('items').doc(id).get()).data(),after=(await rx.ref.collection('items').doc(id).get()).data();check(id+' same medication dose schedule',before.drug_name_zh===after.drug_name_zh&&before.dose===after.dose&&JSON.stringify(before.feeding_times)===JSON.stringify(after.feeding_times));}
 const reminders=(await db.collection('medication_reminders').where('patientId','==',s.patientId).get()).docs.map(d=>d.data());
 check('exactly two active new reminders',reminders.filter(d=>d.enabled).length===2&&reminders.filter(d=>d.enabled).every(d=>d.prescriptionId===stage.prescriptionId));
 check('all showcase reminders have no push recipients',reminders.every(d=>d.notifyUserIds.length===0));
 check('visit scenario marked complete',(await db.doc(`calendar_events/${s.patientId}_event_2`).get()).data().isCompleted===true);
 for(const a of s.actors){const ref=db.doc('users/'+a.profileId),d=(await ref.get()).data();check(a.key+' no device token',!d.pushToken&&!d.expoPushToken&&(await ref.collection('devices').get()).empty);}
 const notifications=await db.collection('notifications').where('patientId','==',s.patientId).get();check('all notification recipients remain inside cohort',notifications.docs.every(d=>s.actors.some(a=>a.uid===d.data().recipientUid)));check('no push sent',notifications.docs.every(d=>d.data().pushStatus!=='sent'));
 const apiKey=fs.readFileSync(path.join(c.root,'firebase/firebaseConfig.ts'),'utf8').match(/apiKey: "([^"]+)"/)[1],app=initializeApp({projectId:s.projectId,apiKey,authDomain:s.projectId+'.firebaseapp.com'},'postvisit-verify'),auth=getAuth(app),client=getFirestore(app),ref=doc(client,'patients',s.patientId,'care_handbook','main');
 const denied=async(name,fn)=>{try{await fn();throw Error('Unexpected access');}catch(e){assert.equal(e.code,'permission-denied',name);check(name,true);}};
 await denied('anonymous handbook read denied',()=>getDoc(ref));
 for(const a of s.actors){await signInWithEmailAndPassword(auth,a.email,a.password);const d=(await getDoc(ref)).data();check(a.key+' can read updated handbook',d.otherNotes.includes('10/16 回診資料')&&d.medicationNotes.includes('10/16 回診用藥整理'));if(a.role==='caregiver')await denied('caregiver write denied in production',()=>setDoc(ref,{...d,updatedBy:a.uid,updatedAt:serverTimestamp()}));await signOut(auth);}
 await deleteApp(app);
 const report={passed:checks.length,checkedAt:new Date().toISOString(),notificationCount:notifications.size,checks};fs.writeFileSync(path.join(c.root,'output/playwright/care-postvisit/verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:checks.length,notificationCount:notifications.size}));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
