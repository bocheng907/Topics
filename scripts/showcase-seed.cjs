// Owner-authorized dedicated production showcase. Data is synthetic and tracked server-side.
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const common=require('./showcase-common.cjs');
async function main(){
 if(process.env.CONFIRM_SHOWCASE_PROJECT!=='smart-care-system-1a41e')throw Error('Explicit target required');
 const s=common.state();const {db,auth,FieldValue,Timestamp}=await common.admin();
 const registry=db.doc('_showcase_groups/'+s.id);const rs=await registry.get();
 if(!rs.exists||rs.data().synthetic!==true)throw Error('Missing synthetic registry');
 if(rs.data().seededAt){console.log('Already seeded',s.id);return;}
 assert.equal(s.actors.length,3);const [family,brother,caregiver]=s.actors;
 for(const a of s.actors){
  const u=await auth.getUser(a.uid);assert.equal(u.customClaims.showcaseId,s.id);
  const p=await db.doc('users/'+a.profileId).get();assert.equal(p.data().uid,a.uid);assert.equal(p.data().activePatientId,'');
  assert.ok(!p.data().pushToken&&!p.data().expoPushToken);assert.equal((await p.ref.collection('devices').get()).size,0);
 }
 const id=s.patientId||('showcase_'+s.id.slice(10));const code=s.id.replace(/-/g,'').slice(-8).toUpperCase();
 s.patientId=id;s.patientsId=code;common.save(s);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const day=n=>new Date(new Date(today+'T12:00:00+08:00').getTime()+n*86400000).toISOString().slice(0,10);
 const at=(d,time)=>Timestamp.fromDate(new Date(d+'T'+time+':00+08:00'));
 const ts=FieldValue.serverTimestamp();const paths=[];const batch=db.batch();
 function add(p,data){assert.ok(p.includes(id)||p.includes(code));paths.push(p);batch.create(db.doc(p),data);}
 add('patients/'+id,{patientsId:code,name:'陳建國',notes:'喜歡早上散步與聽老歌。起身先坐穩，外出由家人或照護員陪同。',families:[family.uid,brother.uid],caregivers:[caregiver.uid],primaryFamilyUid:family.uid,createdBy:family.uid,createdAt:ts,familyGroupId:id,emergencyPhone1:'',emergencyPhone2:''});
 for(const a of s.actors)batch.update(db.doc('users/'+a.profileId),{activePatientId:id});
 add(`patients/${id}/care_handbook/main`,{patientId:id,updatedBy:family.uid,updatedAt:ts,dailyRoutine:'早上七點半起床，早餐後到附近公園散步。午餐後休息半小時，晚上九點準備休息。',medicationNotes:'用藥以門診藥單為準，服用後記錄時間。回診時攜帶藥袋與一週量測紀錄。',dietNotes:'早餐喜歡燕麥粥和水煮蛋。餐點煮軟一些，飲水杯放在伸手可及的位置。',mobilityNotes:'起身前先坐穩，走路時在旁陪同。外出穿止滑鞋，遇到下雨改在室內活動。',hygieneNotes:'晚餐後協助盥洗，浴室地面保持乾燥。',sleepNotes:'午睡約半小時，睡前把走道的小夜燈打開。',communicationNotes:'稱呼建國伯伯，說話放慢，一次說明一件事情。喜歡聊種花與以前工作的故事。',emergencyNotes:'身體不舒服時先停止活動並聯絡家屬；緊急狀況立即尋求醫療協助。',otherNotes:`${day(1)} 上午九點半回診，雅婷陪同，志明負責接送。`});
 const rx=`${id}_prescription_october`;s.prescriptionId=rx;
 add('prescriptions/'+rx,{patientId:id,patientsId:code,createdBy:family.uid,createdAt:at(day(-6),'10:30'),title:'10月門診用藥',status:'parsed',clinic_name:'社區家庭醫學門診',department:'家庭醫學科',visit_date:day(-6),patient_name:'陳建國',memo:'回診時攜帶本次藥袋與居家量測紀錄。',sourceImageUrl:'',aiRaw:{}});
 const meds=[['Amlodipine 5 mg','1 錠','08:00'],['Metformin 500 mg','1 錠','18:00']];
 const reminders=meds.map(([name,dose,time],i)=>{const item=`item-0${i+1}`;const rid=`${rx}_reminder_${item}_${time.replace(':','-')}`;
  add(`prescriptions/${rx}/items/${item}`,{itemId:item,raw:name,drug_name_zh:name,drug_name:name,dose,dosage:dose,quantity:'7',usage_zh:i?'晚餐後':'早餐後',feeding_times:[time],memo:'依門診處方使用。',note_zh:'依門診處方使用。',drug_name_translated:'',note_translated:''});
  add('medication_reminders/'+rid,{reminderId:rid,patientId:id,patientsId:code,prescriptionId:rx,prescriptionItemId:item,itemOrder:i+1,medicineName:name,doseText:dose,scheduleTime:time,notifyUserIds:[],enabled:true,lastSentDate:today,createdAt:ts,updatedAt:ts});
  return {id:rid,name,dose,time};
 });
 const readings=[[36.5,76,132,80,104],[36.6,75,130,79,102],[36.4,74,128,78,101],[36.6,78,134,82,106],[36.5,76,129,79,103],[36.5,73,127,77,100],[36.6,75,128,78,102]];
 const notes=[['早餐後散步','早餐吃了燕麥粥和水煮蛋。到公園走了十五分鐘，回家後坐下休息，精神不錯。'],['整理回診資料','已把上次藥袋放進回診資料夾，雅婷會再確認掛號時間。'],['週日家人探訪','志明下午帶了水果過來，伯伯聊了以前種花的事情，心情很好。'],['雨天改室內活動','早上下雨，改在客廳走動與伸展。午餐後休息半小時，沒有外出。'],['日常量測與飲食','早上量測已登錄。午餐吃了魚肉、青菜和半碗飯，下午一起整理陽台盆栽。'],['確認接送安排','已和雅婷確認星期五回診，志明八點四十五分到家接送。'],['回診物品已備妥','健保卡、藥袋與一週量測紀錄已放進藍色資料夾，明天出門前再確認一次。']];
 for(let i=0;i<7;i++){const date=day(i-6),r=readings[i];
  add(`health_records/${id}_${date}_morning`,{patientId:id,caregiverId:caregiver.uid,createdAt:at(date,'07:45'),temperature:r[0],heartRate:r[1],bloodPressureSys:r[2],bloodPressureDia:r[3],bloodSugar:r[4],bloodSugarType:'空腹'});
  add(`care_notes/${id}_${date}`,{patientDocId:id,patientId:code,caregiverUid:caregiver.uid,title:notes[i][0],content:notes[i][1],language:'zh',isPinned:i===6,createdAt:at(date,'16:30'),updatedAt:at(date,'16:30')});
  for(const m of reminders){const lid=`${date}_medlog_slot_pat_${code}_${m.time.replace(':','-')}`;
   add('medication_logs/'+lid,{logId:lid,patientId:id,patientsId:code,reminderId:m.id,reminderIds:[m.id],prescriptionId:rx,prescriptionIds:[rx],medicineName:m.name,medicineNames:[m.name],doseText:m.dose,scheduleTime:m.time,status:'taken',confirmedBy:caregiver.uid,takenAt:at(date,m.time),dateKey:date,createdAt:at(date,m.time)});
  }
 }
 const events=[[-4,'15:00','家人探訪','家中客廳',brother.uid,true],[0,'16:30','整理回診資料','家中',caregiver.uid,true],[1,'09:30','家庭醫學科回診','社區門診一樓報到櫃台',family.uid,false]];
 events.forEach(([offset,time,title,location,owner,done],i)=>{const date=day(offset);add(`calendar_events/${id}_event_${i}`,{patientId:id,patientsId:code,createdBy:owner,createdAt:at(day(-6),'11:00'),updatedAt:ts,name:'陳建國',personName:'陳建國',name_zh:'陳建國',title,eventTitle:title,title_zh:title,location,location_zh:location,color:'#6EA9E8',startAt:at(date,time),eventDate:date,hour:String(Number(time.slice(0,2))%12||12),minute:time.slice(3),period:Number(time.slice(0,2))>=12?'pm':'am',isCompleted:done,...(done?{completedAt:at(date,time),completedBy:owner}:{})});});
 const chats=[
 [-6,'09:10',caregiver,'雅婷早安，伯伯今天早餐吃得不錯，量測紀錄已登錄，等一下陪他到公園走走。'],
 [-6,'09:18',family,'謝謝怡君，爸爸喜歡看公園的花，走累了就陪他坐一下。'],
 [-5,'17:10',caregiver,'今天的藥袋已整理好，回診資料夾放在客廳櫃子上。'],
 [-5,'17:20',family,'收到，我晚上會確認掛號時間，再補到行事曆。'],
 [-4,'14:30',brother,'我三點左右到家，帶一點水果過去陪爸爸。'],
 [-4,'14:38',caregiver,'好，伯伯剛午睡起來，精神不錯，我先幫他準備一杯水。'],
 [-3,'09:00',caregiver,'今天下雨，就不去公園了，我陪伯伯在客廳走動，地板也已經擦乾。'],
 [-3,'09:12',family,'這樣很好，外出等天氣好一點再安排。'],
 [-2,'16:40',caregiver,'今天量測已登錄，下午和伯伯一起整理陽台的盆栽，他很開心。'],
 [-2,'17:00',brother,'爸爸以前最喜歡種花了，謝謝妳陪他。'],
 [-1,'18:10',family,'星期五上午九點半回診，行事曆已經更新。我陪爸爸看診，志明幫忙接送。'],
 [-1,'18:20',brother,'沒問題，我八點四十五分到家，車子會停在門口。'],
 [0,'17:00',caregiver,'明天回診要帶的健保卡、藥袋和一週量測紀錄已放進藍色資料夾，放在客廳櫃子上。'],
 [0,'17:12',family,'謝謝，明天我八點半先到家，再一起確認資料。'],
 ];
 chats.forEach(([d,time,a,text],i)=>add(`chats/${id}/messages/week_${String(i).padStart(2,'0')}`,{senderId:a.uid,senderName:a.name,senderAvatarUrl:'',text,text_zh:text,text_original:text,createdAt:at(day(d),time)}));
 [['明天我陪爸爸進診間，你方便幫忙停車嗎？',family],['可以，我先讓你們在門口下車，停好再過去會合。',brother],['好，醫師說明的重點我會記下來，回家後再和怡君交接。',family]].forEach(([text,a],i)=>add(`chats/${id}/familyMessages/week_${i}`,{senderId:a.uid,senderName:a.name,senderAvatarUrl:'',text,text_zh:text,text_original:text,createdAt:at(today,`19:0${i}`)}));
 batch.update(registry,{patientId:id,documentPaths:paths,storyStart:day(-6),storyEnd:today,seededAt:ts,notificationIsolation:'Only dedicated showcase UIDs; no device tokens; reminder notifyUserIds empty',synthetic:true});
 await batch.commit();common.save(s);
 const countByCollection={};for(const p of paths){const c=p.split('/')[0];countByCollection[c]=(countByCollection[c]||0)+1;}
 const report={projectId:s.projectId,datasetId:s.id,patientId:id,synthetic:true,accountCount:3,storyStart:day(-6),storyEnd:today,documents:paths.length,countByCollection,createdAt:new Date().toISOString()};
 fs.writeFileSync(path.join(common.root,'output/playwright/care-week/seed-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
