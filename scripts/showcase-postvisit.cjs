// Dedicated synthetic follow-up scenario, not a real appointment or prescribing advice.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const c=require('./showcase-common.cjs');
async function main(){
 if(process.env.CONFIRM_SHOWCASE_PROJECT!=='smart-care-system-1a41e')throw Error('Explicit target required');
 const s=c.state(),{db,auth,FieldValue,Timestamp}=await c.admin(),reg=db.doc('_showcase_groups/'+s.id),r=await reg.get();
 assert.equal(r.data()?.synthetic,true);assert.equal(r.data().patientId,s.patientId);
 if(r.data().postvisitStage){console.log('Post-visit stage already exists; no duplicate writes');return;}
 const [f,b,g]=s.actors,patientRef=db.doc('patients/'+s.patientId),patient=await patientRef.get();
 assert.deepEqual([...patient.data().families,...patient.data().caregivers].sort(),s.actors.map(a=>a.uid).sort());
 for(const a of s.actors){assert.equal((await auth.getUser(a.uid)).customClaims.showcaseId,s.id);const u=db.doc('users/'+a.profileId),d=(await u.get()).data();assert.ok(!d.pushToken&&!d.expoPushToken);assert.equal((await u.collection('devices').get()).size,0);}
 const oldRx=db.doc('prescriptions/'+s.prescriptionId),old=await oldRx.get();assert.equal(old.data().patientId,s.patientId);
 const items=await oldRx.collection('items').orderBy('itemId').get();assert.equal(items.size,2);
 const oldRem=await db.collection('medication_reminders').where('prescriptionId','==',s.prescriptionId).get();assert.equal(oldRem.size,2);
 for(const d of oldRem.docs){assert.equal(d.data().patientId,s.patientId);assert.deepEqual(d.data().notifyUserIds,[]);}
 const eventRef=db.doc(`calendar_events/${s.patientId}_event_2`),event=await eventRef.get();assert.equal(event.data().patientId,s.patientId);assert.equal(event.data().eventDate,'2026-10-16');assert.equal(event.data().isCompleted,false);
 const rx=s.patientId+'_prescription_followup_20261016',ts=FieldValue.serverTimestamp(),paths=[],batch=db.batch();
 const backup={event:event.data(),reminders:oldRem.docs.map(d=>({path:d.ref.path,data:d.data()})),capturedAt:new Date().toISOString()};
 const out=path.join(c.root,'output/playwright/care-postvisit');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'before-stage.json'),JSON.stringify(backup,null,2));
 function add(p,data){assert.ok(p.includes(s.patientId));paths.push(p);batch.create(db.doc(p),data);}
 const timing={scenarioDate:'2026-10-16',scenarioTime:'11:30',recordedAt:ts};
 add('prescriptions/'+rx,{...old.data(),createdBy:f.uid,createdAt:ts,updatedAt:ts,visit_date:'2026-10-16',title:'10/16 回診用藥整理',memo:'回診後已和家屬核對藥袋；藥品、劑量及時段維持原資料。舊藥單保留查閱，日常提醒以本張為準。',sourceImageUrl:'',aiRaw:{}});
 for(const item of items.docs)add(`prescriptions/${rx}/items/${item.id}`,{...item.data(),updatedAt:ts});
 for(const d of oldRem.docs){const m=d.data(),id=rx+'_reminder_'+m.prescriptionItemId+'_'+m.scheduleTime.replace(':','-');add('medication_reminders/'+id,{...m,reminderId:id,prescriptionId:rx,enabled:true,notifyUserIds:[],lastSentDate:'',createdAt:ts,updatedAt:ts});batch.update(d.ref,{enabled:false,updatedAt:ts},{lastUpdateTime:d.updateTime});}
 batch.update(eventRef,{isCompleted:true,completedAt:ts,completedBy:f.uid,updatedAt:ts},{lastUpdateTime:event.updateTime});
 add(`care_notes/${s.patientId}_postvisit_handoff`,{patientDocId:s.patientId,patientId:s.patientsId,caregiverUid:g.uid,title:'回診後交接與藥袋核對',content:'雅婷已整理今天回診的資料，藥袋與量測紀錄放回客廳藍色資料夾。已核對本次藥單，藥品、劑量及時段維持原資料；舊藥單保留查閱，不重複使用舊提醒。交班前確認手冊、晚餐後服藥紀錄及家屬訊息。',language:'zh',isPinned:true,createdAt:ts,updatedAt:ts});
 add(`calendar_events/${s.patientId}_postvisit_handoff`,{patientId:s.patientId,patientsId:s.patientsId,createdBy:f.uid,createdAt:ts,updatedAt:ts,name:'陳建國',personName:'陳建國',name_zh:'陳建國',title:'回診後照護交接',eventTitle:'回診後照護交接',title_zh:'回診後照護交接',location:'家中客廳，藍色資料夾',location_zh:'家中客廳，藍色資料夾',color:'#6EA9E8',startAt:Timestamp.fromDate(new Date('2026-10-16T11:30:00+08:00')),eventDate:'2026-10-16',hour:'11',minute:'30',period:'am',isCompleted:false});
 // Stage provenance is server-only. Actual createdAt/completedAt are never backdated.
 batch.update(reg,{postvisitStage:{...timing,prescriptionId:rx,documentPaths:paths,source:'owner-authorized synthetic follow-up rehearsal',clinicalEvent:false,medicationAdministrationRecorded:false},updatedAt:ts},{lastUpdateTime:r.updateTime});
 await batch.commit();
 const report={synthetic:true,scenarioDate:'2026-10-16',actualRecordedAt:new Date().toISOString(),patientId:s.patientId,prescriptionId:rx,createdPaths:paths,oldPrescriptionPreserved:true,oldRemindersDisabled:2,newReminders:2,medicationAdministrationRecorded:false};
 fs.writeFileSync(path.join(out,'stage.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
