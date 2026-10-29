const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const c=require('./showcase-common.cjs');
const {initializeApp,deleteApp}=require('firebase/app');const {getAuth,signInWithEmailAndPassword,signOut}=require('firebase/auth');const {getFirestore,doc,getDoc,collection,getDocs}=require('firebase/firestore');
async function main(){const s=c.state(),{db}=await c.admin(),results=[];
 const check=(name,ok)=>{assert.ok(ok,name);results.push({name,passed:true});};
 const reg=(await db.doc('_showcase_groups/'+s.id).get()).data();check('server-side synthetic provenance retained',reg.synthetic===true);
 const patient=(await db.doc('patients/'+s.patientId).get()).data();check('exactly three dedicated members',JSON.stringify([...patient.families,...patient.caregivers].sort())===JSON.stringify(s.actors.map(a=>a.uid).sort()));
 for(const a of s.actors){const ref=db.doc('users/'+a.profileId),p=(await ref.get()).data();check(a.key+' has current consent',p.privacyConsent.version==='2026-09-22.v2');check(a.key+' has no push tokens',!p.pushToken&&!p.expoPushToken&&(await ref.collection('devices').get()).size===0);}
 for(const p of reg.documentPaths)check('exists '+p,(await db.doc(p).get()).exists);
 const notifications=await db.collection('notifications').where('patientId','==',s.patientId).get();check('real triggers created notifications',notifications.size>0);check('notifications target showcase accounts only',notifications.docs.every(d=>s.actors.some(a=>a.uid===d.data().recipientUid)));check('no push marked sent',notifications.docs.every(d=>d.data().pushStatus!=='sent'));
 const configText=fs.readFileSync(path.join(c.root,'firebase/firebaseConfig.ts'),'utf8');const apiKey=configText.match(/apiKey: "([^"]+)"/)[1];
 const app=initializeApp({projectId:s.projectId,apiKey,authDomain:s.projectId+'.firebaseapp.com'},'showcase-verify');const auth=getAuth(app),client=getFirestore(app);
 const denied=async(name,action)=>{try{await action();throw Error('Unexpected access: '+name);}catch(e){assert.equal(e.code,'permission-denied',name);results.push({name,passed:true});}};
 await denied('anonymous cannot read group',()=>getDoc(doc(client,'patients',s.patientId)));
 for(const a of s.actors){await signInWithEmailAndPassword(auth,a.email,a.password);check(a.key+' reads linked patient',(await getDoc(doc(client,'patients',s.patientId))).exists());check(a.key+' reads prescription',(await getDoc(doc(client,'prescriptions',s.prescriptionId))).exists());
 if(a.role==='family')check(a.key+' reads family-only chat',(await getDocs(collection(client,'chats',s.patientId,'familyMessages'))).size>=3);
 else await denied('caregiver cannot read family-only chat',()=>getDocs(collection(client,'chats',s.patientId,'familyMessages')));
 await denied(a.key+' cannot read backend showcase registry',()=>getDoc(doc(client,'_showcase_groups',s.id)));
 const other=s.actors.find(x=>x.uid!==a.uid);await denied(a.key+' cannot read other private user profile',()=>getDoc(doc(client,'users',other.profileId)));await signOut(auth);}
 await deleteApp(app);const report={passed:results.length,notificationCount:notifications.size,results,checkedAt:new Date().toISOString()};fs.writeFileSync(path.join(c.root,'output/playwright/care-week/verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:results.length,notificationCount:notifications.size}));}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
