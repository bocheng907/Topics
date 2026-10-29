const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const c=require('./care-shift-common.cjs');
const {initializeApp,deleteApp}=require('firebase/app'),{getAuth,signInWithEmailAndPassword,signOut}=require('firebase/auth');
const {getFirestore,doc,getDocFromServer,getDocsFromServer,collection,query,where}=require('firebase/firestore');
async function main(){
 const s=c.state(),old=c.priorState(),{db}=await c.admin(),checks=[],stage=(await db.doc('_showcase_groups/'+s.id).get()).data();assert.equal(stage.synthetic,true);assert.ok(stage.seededAt);
 const ck=(name,ok)=>{assert.ok(ok,name);checks.push({name,passed:true});},m=s.actors[0],y=s.actors[1],f=old.actors[0],patients=[old.patientId,s.patientId];
 const apiKey=fs.readFileSync(path.join(c.root,'firebase/firebaseConfig.ts'),'utf8').match(/apiKey: "([^"]+)"/)[1],app=initializeApp({projectId:s.projectId,apiKey,authDomain:s.projectId+'.firebaseapp.com'},'shift-verify'),auth=getAuth(app),client=getFirestore(app);
 const denied=async(name,fn)=>{try{await fn();throw Error('Unexpected access');}catch(e){assert.equal(e.code,'permission-denied',name);ck(name,true);}};
 const read=(pid,sub)=>getDocFromServer(doc(client,'patients',pid,...(sub?['care_handbook','main']:[])));
 const list=(col,pid)=>getDocsFromServer(query(collection(client,col),where('patientId','==',pid)));
 try{
 for(const pid of patients)await denied('anonymous cannot read '+pid,()=>read(pid));
 for(const [a,own,other]of [[f,old.patientId,s.patientId],[y,s.patientId,old.patientId]]){await signInWithEmailAndPassword(auth,a.email,a.password);ck(a.key+' can read own patient',(await read(own)).exists());ck(a.key+' can read own handbook',(await read(own,true)).exists());ck(a.key+' has own health records',(await list('health_records',own)).size>0);await denied(a.key+' cannot read other patient',()=>read(other));await denied(a.key+' cannot read other handbook',()=>read(other,true));await denied(a.key+' cannot query other health records',()=>list('health_records',other));await denied(a.key+' cannot query other prescriptions',()=>list('prescriptions',other));await denied(a.key+' cannot read other shared chat',()=>getDocsFromServer(collection(client,'chats',other,'messages')));await denied(a.key+' cannot read other private family chat',()=>getDocsFromServer(collection(client,'chats',other,'familyMessages')));await signOut(auth);}
 await signInWithEmailAndPassword(auth,m.email,m.password);
 const linked=await getDocsFromServer(query(collection(client,'patients'),where('caregivers','array-contains',m.uid)));ck('Meiling has exactly two linked patients',linked.size===2&&linked.docs.every(d=>patients.includes(d.id)));
 for(const pid of patients){ck('Meiling reads handbook '+pid,(await read(pid,true)).exists());ck('Meiling reads shared chat '+pid,(await getDocsFromServer(collection(client,'chats',pid,'messages'))).size>0);await denied('Meiling cannot read family-only chat '+pid,()=>getDocsFromServer(collection(client,'chats',pid,'familyMessages')));}
 ck('Chen has both original and follow-up prescriptions',(await list('prescriptions',old.patientId)).size===2);ck('Lin has no Chen prescriptions',(await list('prescriptions',s.patientId)).size===0);
 await signOut(auth);
 for(const a of [...s.actors,...old.actors]){const ref=db.doc('users/'+a.profileId),d=(await ref.get()).data();ck(a.key+' no push device',!d.pushToken&&!d.expoPushToken&&(await ref.collection('devices').get()).empty);}
 for(const pid of patients){const p=(await db.doc('patients/'+pid).get()).data(),allowed=[...p.families,...p.caregivers,...(pid===old.patientId?[old.actors[2].uid]:[])],n=await db.collection('notifications').where('patientId','==',pid).get();ck('notifications stay in corresponding cohort '+pid,n.docs.every(d=>allowed.includes(d.data().recipientUid)));ck('no push sent '+pid,n.docs.every(d=>d.data().pushStatus!=='sent'));}
 if(stage.uiHealthRecordId){const h=(await db.doc('health_records/'+stage.uiHealthRecordId).get()).data();ck('UI health record belongs to Lin, not Chen',h.patientId===s.patientId&&h.patientId!==old.patientId);ck('UI health record attributed to Meiling',h.caregiverId===m.uid&&h.temperature===36.3&&h.heartRate===71);}
 const linChat=await db.collection('chats').doc(s.patientId).collection('messages').get(),chenChat=await db.collection('chats').doc(old.patientId).collection('messages').get();
 for(const text of ['宜芳您好，我是美玲，已讀過秀英阿姨的看護手冊，也看到相簿的安排。這次量測已登錄，接下來會先陪阿姨整理客廳。','謝謝美玲，媽媽喜歡一邊聽老歌一邊看照片。我下班會把相簿帶回去，有需要確認的事情再傳訊息給我。']){ck('UI message exists once in Lin chat '+text.slice(0,8),linChat.docs.filter(d=>d.data().text===text).length===1);ck('UI message absent from Chen chat '+text.slice(0,8),chenChat.docs.every(d=>d.data().text!==text));}
 const report={passed:checks.length,checks,checkedAt:new Date().toISOString(),synthetic:true};fs.writeFileSync(path.join(c.out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:checks.length}));
 }finally{await deleteApp(app);}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
