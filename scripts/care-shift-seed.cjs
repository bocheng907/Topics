// Only the explicitly authorized, isolated showcase groups. Never existing real users.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const c=require('./care-shift-common.cjs');
const {initializeApp,deleteApp}=require('firebase/app'),{getAuth,signInWithEmailAndPassword}=require('firebase/auth'),{getFunctions,httpsCallable}=require('firebase/functions');
async function main(){
 if(process.env.CONFIRM_SHOWCASE_PROJECT!=='smart-care-system-1a41e')throw Error('Explicit target required');
 const s=c.state(),old=c.priorState(),{db,auth,FieldValue,Timestamp}=await c.admin(),reg=db.doc('_showcase_groups/'+s.id),priorReg=await db.doc('_showcase_groups/'+old.id).get();
 assert.equal(priorReg.data()?.synthetic,true);assert.equal((await reg.get()).data()?.synthetic,true);
 if((await reg.get()).data().seededAt){console.log('Already seeded; no duplicate writes');return;}
 const m=s.actors.find(a=>a.key==='meiling'),y=s.actors.find(a=>a.key==='yifang');
 for(const a of [...s.actors,...old.actors]){const u=await auth.getUser(a.uid);assert.equal(u.customClaims.showcaseId,s.actors.includes(a)?s.id:old.id);const ref=db.doc('users/'+a.profileId),p=(await ref.get()).data();assert.ok(!p.pushToken&&!p.expoPushToken);assert.equal((await ref.collection('devices').get()).size,0);}
 const chen=db.doc('patients/'+old.patientId),pd=(await chen.get()).data();assert.equal(priorReg.data().patientId,old.patientId);assert.deepEqual(pd.families.sort(),old.actors.filter(a=>a.role==='family').map(a=>a.uid).sort());assert.ok(pd.caregivers.every(uid=>[old.actors[2].uid,m.uid].includes(uid)));
 fs.mkdirSync(c.out,{recursive:true});const backup=path.join(c.out,'before-membership.json');if(!fs.existsSync(backup))fs.writeFileSync(backup,JSON.stringify({patientId:old.patientId,caregivers:pd.caregivers,recordedAt:new Date().toISOString()},null,2));
 const apiKey=fs.readFileSync(path.join(c.root,'firebase/firebaseConfig.ts'),'utf8').match(/apiKey: "([^"]+)"/)[1],app=initializeApp({projectId:s.projectId,apiKey,authDomain:s.projectId+'.firebaseapp.com'},'shift-seed'),clientAuth=getAuth(app),functions=getFunctions(app,'us-central1');
 const as=async(a,name,data)=>{await signInWithEmailAndPassword(clientAuth,a.email,a.password);return (await httpsCallable(functions,name)(data)).data;};
 try{
  if(!s.patientId){const candidates=await db.collection('patients').where('createdBy','==',y.uid).get();assert.ok(candidates.size<=1);if(candidates.size){assert.equal(candidates.docs[0].data().name,'林秀英');s.patientId=candidates.docs[0].id;}else{s.patientId=(await as(y,'createCareTarget',{name:'林秀英',notes:'喜歡聽台語老歌與整理相簿；外出前先確認眼鏡、外套與鑰匙。'})).patientId;}c.save(s);}
  const lin=db.doc('patients/'+s.patientId),linData=(await lin.get()).data();assert.equal(linData.createdBy,y.uid);assert.deepEqual(linData.families,[y.uid]);assert.ok(linData.caregivers.every(uid=>uid===m.uid));s.patientsId=linData.patientsId;c.save(s);
  const operations=[];
  for(const [patientId,family] of [[old.patientId,old.actors[0]],[s.patientId,y]]){
   const p=(await db.doc('patients/'+patientId).get()).data();if(p.caregivers.includes(m.uid)){operations.push({patientId,alreadyLinked:true});continue;}
   await as(family,'manageInvitation',{patientId,action:'regenerate'});
   const inv=await as(family,'manageInvitation',{patientId,action:'get'});assert.equal(inv.status,'active');
   const join=await as(m,'joinCareTarget',{code:inv.code});assert.equal(join.patientId,patientId);assert.equal(join.status,'pending');
   const pending=await as(family,'manageInvitation',{patientId,action:'get'});assert.equal(pending.applicantUid,m.uid);assert.equal(pending.status,'pending');
   await as(family,'manageInvitation',{patientId,action:'approve',requestId:pending.requestId});assert.ok((await db.doc('patients/'+patientId).get()).data().caregivers.includes(m.uid));operations.push({patientId,joinedViaCallable:true,requiredApproval:true,approved:true});
  }
  const ts=FieldValue.serverTimestamp(),batch=db.batch(),paths=[];const add=(p,d)=>{assert.ok(p.includes(s.patientId));paths.push(p);batch.create(db.doc(p),d);};
  add(`patients/${s.patientId}/care_handbook/main`,{patientId:s.patientId,updatedBy:y.uid,updatedAt:ts,dailyRoutine:'早餐後喜歡坐在窗邊聽台語老歌，下午一起整理相簿。',medicationNotes:'目前尚未上傳藥單，請先向宜芳確認藥袋與門診資料，不沿用其他長者的藥單。',dietNotes:'喜歡溫熱的粥與蒸蛋，餐具放在桌面容易拿取的位置。',mobilityNotes:'外出前一起確認眼鏡、外套與鑰匙，走樓梯時在旁陪同。',hygieneNotes:'盥洗用品放在浴室左側架子，使用完畢擦乾地面。',sleepNotes:'午餐後喜歡安靜休息，拉上薄窗簾即可。',communicationNotes:'稱呼秀英阿姨，聊天時放慢速度；可以從家人的老照片開始聊。',emergencyNotes:'身體不舒服時先停止活動並聯絡宜芳；緊急狀況立即尋求醫療協助。',otherNotes:'宜芳今天下班後會帶相簿回來，請先把客廳茶几整理好。'});
  add(`health_records/${s.patientId}_arrival`,{patientId:s.patientId,caregiverId:m.uid,temperature:36.4,heartRate:72,bloodPressureSys:122,bloodPressureDia:74,bloodSugar:98,bloodSugarType:'空腹',createdAt:ts});
  add(`care_notes/${s.patientId}_arrival`,{patientDocId:s.patientId,patientId:s.patientsId,caregiverUid:m.uid,title:'秀英阿姨的相簿時間',content:'宜芳說阿姨喜歡看家人的老照片。下午會一起整理茶几，等宜芳帶相簿回來再慢慢翻看。',language:'zh',isPinned:true,createdAt:ts,updatedAt:ts});
  add(`chats/${s.patientId}/messages/welcome`,{senderId:y.uid,senderName:y.name,senderAvatarUrl:'',text:'美玲您好，媽媽習慣早餐後聽老歌，手冊裡有日常作息。我下班後帶相簿回家，有問題在這裡找我就好。',text_zh:'美玲您好，媽媽習慣早餐後聽老歌，手冊裡有日常作息。我下班後帶相簿回家，有問題在這裡找我就好。',text_original:'美玲您好，媽媽習慣早餐後聽老歌，手冊裡有日常作息。我下班後帶相簿回家，有問題在這裡找我就好。',createdAt:ts});
  add(`chats/${s.patientId}/familyMessages/family-plan`,{senderId:y.uid,senderName:y.name,senderAvatarUrl:'',text:'今晚把相簿帶回去，陪媽媽看看以前出遊的照片。',text_zh:'今晚把相簿帶回去，陪媽媽看看以前出遊的照片。',text_original:'今晚把相簿帶回去，陪媽媽看看以前出遊的照片。',createdAt:ts});
  add(`calendar_events/${s.patientId}_album`,{patientId:s.patientId,patientsId:s.patientsId,createdBy:y.uid,createdAt:ts,updatedAt:ts,name:'林秀英',personName:'林秀英',name_zh:'林秀英',title:'一起整理家庭相簿',eventTitle:'一起整理家庭相簿',title_zh:'一起整理家庭相簿',location:'家中客廳',location_zh:'家中客廳',color:'#9BCBC0',startAt:Timestamp.fromDate(new Date('2026-10-16T19:00:00+08:00')),eventDate:'2026-10-16',hour:'7',minute:'00',period:'pm',isCompleted:false});
  batch.update(db.doc('users/'+m.profileId),{activePatientId:old.patientId});batch.update(db.doc('users/'+y.profileId),{activePatientId:s.patientId});
  batch.update(reg,{patientId:s.patientId,relatedPatientIds:[old.patientId,s.patientId],relatedShowcaseId:old.id,synthetic:true,documentPaths:paths,joinOperations:operations,seededAt:ts,updatedAt:ts});
  await batch.commit();fs.writeFileSync(path.join(c.out,'seed-report.json'),JSON.stringify({synthetic:true,patientId:s.patientId,joinedViaRealCallables:operations,documentPaths:paths,actualCreatedAt:new Date().toISOString()},null,2));console.log('PASS two-patient cohort prepared with real invitation approval flow');
 }finally{await deleteApp(app);}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
