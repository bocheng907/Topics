const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {randomUUID}=require('node:crypto');
const sdk=require('firebase/firestore');
const authSdk=require('firebase/auth');
const {initializeApp,deleteApp}=require('firebase/app');
const admin=require('../functions/node_modules/firebase-admin');
const {evaluateHealthRecord}=require('../functions/healthThresholds');
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18298'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:19099'||process.env.GCLOUD_PROJECT!=='demo-care-walkthrough')throw Error('Isolated demo emulators required');
const projectId='demo-care-walkthrough',app=initializeApp({projectId,apiKey:'local-only'},randomUUID());
const auth=authSdk.getAuth(app);authSdk.connectAuthEmulator(auth,'http://127.0.0.1:19099',{disableWarnings:true});
const db=sdk.getFirestore(app);sdk.connectFirestoreEmulator(db,'127.0.0.1',18298);
const adminApp=admin.initializeApp({projectId},'exception-'+randomUUID()),adb=adminApp.firestore();
after(async()=>{await deleteApp(app);await adminApp.delete();});
function handler(file,name,bindings){
  const source=fs.readFileSync(require.resolve('../'+file),'utf8');
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found;
  function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)found=n.initializer;if(ts.isFunctionDeclaration(n)&&n.name?.text===name)found=n;ts.forEachChild(n,visit);}visit(ast);
  assert.ok(found,name);
  const code=ts.transpileModule('exports.run='+found.getText(ast),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const result={};new Function('exports',...Object.keys(bindings),code)(result,...Object.values(bindings));return result.run;
}
const words=new Proxy({}, {get:(_target,key)=>String(key)});
const empty={temperature:'',heartRate:'',systolic:'',diastolic:'',bloodSugar:''};
for(const [name,form]of [['all blank',empty],['not a number',{...empty,temperature:'NaN'}],['too high',{...empty,temperature:'99'}],['invalid pulse',{...empty,heartRate:'abc'}],['invalid pressure',{...empty,systolic:'999'}],['invalid sugar',{...empty,bloodSugar:'-1'}]]){
  test('health button rejects '+name+' before save',async()=>{
    let saves=0;const alerts=[];
    const validateExtremeValues=handler('app/caregiver/health-report.tsx','validateExtremeValues',{formData:form,t:words});
    const save=handler('app/caregiver/health-report.tsx','handleSave',{savingRef:{current:false},user:{uid:'care'},activePatientId:'p',formData:form,t:words,Alert:{alert:(...a)=>alerts.push(a)},validateExtremeValues,saveHealthOnce:async()=>{saves++}});
    await save();assert.equal(saves,0);assert.equal(alerts.length,1);
  });
}
for(const [field,label,step,limit]of [['temperature','temperature',0.1,38],['heartRate','heartRate',1,100],['bloodPressureSys','systolic',1,140],['bloodPressureDia','diastolic',1,90],['bloodSugar','bloodSugar',1,140]]){
  test('threshold '+field+' below/equal/above boundary',()=>{
    const config={[label]:{enabled:true,max:limit}};
    assert.equal(evaluateHealthRecord({[field]:limit-step},config),'');
    assert.equal(evaluateHealthRecord({[field]:limit},config),'');
    assert.notEqual(evaluateHealthRecord({[field]:limit+step},config),'');
  });
}
for(const role of ['family','caregiver']){
  test(role+' chat double send and rejected network request preserve draft',async()=>{
    let rejectWrite,writes=0;const drafts=[],alerts=[],lock={current:false};
    const bindings={inputText:'下午會整理回診資料。',targetId:'p',user:{uid:'care'},sendLock:lock,setSending:()=>{},chatScope:'care/p',currentScope:{current:'care/p'},generateCustomId:()=>randomUUID(),randomUUID,doc:()=>({}),db:{},messageCollection:'messages',senderProfile:{displayName:'照護員',avatarUrl:''},t:words,copy:{sendFailed:'請重試'},serverTimestamp:()=>0,setInputText:v=>drafts.push(v),Alert:{alert:(...a)=>alerts.push(a)},console:{error(){}},setDoc:()=>{writes++;return new Promise((_,reject)=>{rejectWrite=reject})}};
    const send=handler('app/'+role+'/chat-room.tsx','sendMessage',bindings);
    const first=send();await send();assert.equal(writes,1);rejectWrite(Error('offline'));await first;
    assert.deepEqual(drafts,[]);assert.equal(alerts.length,1);assert.equal(lock.current,false);
    bindings.setDoc=async()=>{writes++};await handler('app/'+role+'/chat-room.tsx','sendMessage',bindings)();
    assert.equal(writes,2);assert.deepEqual(drafts,['']);
  });
  test(role+' denied photo permission never opens picker or uploads',async()=>{
    let alerts=0,opens=0,uploads=0;
    const pick=handler('app/'+role+'/chat-room.tsx','pickImageAndSend',{ImagePicker:{requestMediaLibraryPermissionsAsync:async()=>({granted:false}),launchImageLibraryAsync:async()=>{opens++}},Alert:{alert:()=>{alerts++}},t:words,uploadImage:async()=>{uploads++}});
    await pick();assert.equal(alerts,1);assert.equal(opens,0);assert.equal(uploads,0);
  });
}
let uid;
test('Auth emulator: new signup, duplicate email, wrong and correct reauthentication',async()=>{
  const email=randomUUID()+'@example.invalid',password='Local-only-'+randomUUID();
  const result=await authSdk.createUserWithEmailAndPassword(auth,email,password);uid=result.user.uid;
  await assert.rejects(authSdk.createUserWithEmailAndPassword(auth,email,password),{code:'auth/email-already-in-use'});
  await assert.rejects(authSdk.reauthenticateWithCredential(result.user,authSdk.EmailAuthProvider.credential(email,'Wrong-only-123')));
  await authSdk.reauthenticateWithCredential(result.user,authSdk.EmailAuthProvider.credential(email,password));
  assert.equal(auth.currentUser.uid,uid);
});
test('medication DONE concurrent presses should not report a failed save after success',async()=>{
  assert.ok(uid);const patientId=randomUUID(),alerts=[];
  await adb.doc('users/'+uid).set({uid,role:'caregiver'});
  await adb.doc('patients/'+patientId).set({name:'驗收長輩',caregivers:[uid],families:[]});
  const reminder={id:'r',prescriptionId:'rx',medicineName:'合成藥品',doseText:'依樣張'};
  const doneSubmissionRef={current:{pending:false,completedId:''}};let writes=0;
  const done=handler('app/caregiver/index.tsx','handleDonePress',{doneSubmissionRef,user:{uid},activePatientId:patientId,activePatient:{patientsId:'synthetic'},currentReminder:reminder,activeSlot:{scheduleTime:'08:00',reminders:[reminder]},activeSlotDone:false,setDoneLoading:()=>{},medicationLogId:()=>patientId+'-slot',todayKey:'2026-10-25',db,doc:sdk.doc,setDoc:(...args)=>{writes++;return sdk.setDoc(...args)},serverTimestamp:sdk.serverTimestamp,Alert:{alert:(...a)=>alerts.push(a)},t:words,console:{log(){}}});
  await Promise.all([done(),done()]);
  // Keep activeSlotDone false to reproduce a tap before the snapshot reaches React.
  await done();
  assert.equal(writes,1);
  assert.equal((await adb.collection('medication_logs').where('patientId','==',patientId).get()).size,1);
  assert.equal(alerts.filter(a=>a[1]==='recordFailed').length,0,'Duplicate click produced a failure alert after one successful write');
  assert.equal(alerts.filter(a=>a[1]==='doneRecorded').length,1);
  assert.deepEqual(doneSubmissionRef.current,{pending:false,completedId:patientId+'-slot'});
});

test('medication DONE releases the lock on failure and permits a successful retry',async()=>{
  const alerts=[],loading=[],doneSubmissionRef={current:{pending:false,completedId:''}};
  const reminder={id:'r',medicineName:'合成藥品',doseText:'依樣張'};let writes=0;
  const done=handler('app/caregiver/index.tsx','handleDonePress',{doneSubmissionRef,user:{uid:'care'},activePatientId:'p',activePatient:{patientsId:'synthetic'},currentReminder:reminder,activeSlot:{scheduleTime:'08:00',reminders:[reminder]},activeSlotDone:false,setDoneLoading:v=>loading.push(v),medicationLogId:()=> 'same-slot',todayKey:'2026-10-25',db:{},doc:()=>({}),setDoc:async()=>{writes++;if(writes===1)throw Object.assign(Error('denied'),{code:'permission-denied'})},serverTimestamp:()=>0,Alert:{alert:(...a)=>alerts.push(a)},t:words,console:{log(){}}});
  await done();
  assert.deepEqual(doneSubmissionRef.current,{pending:false,completedId:''});
  assert.equal(alerts.filter(a=>a[1]==='recordFailed').length,1);
  assert.equal(alerts.filter(a=>a[1]==='doneRecorded').length,0);
  await done();await done();
  assert.equal(writes,2);
  assert.equal(alerts.filter(a=>a[1]==='doneRecorded').length,1);
  assert.deepEqual(loading,[true,false,true,false]);
  assert.equal(doneSubmissionRef.current.pending,false);
});

test('medication DONE allows a different slot after a successful confirmation',async()=>{
  const alerts=[],doneSubmissionRef={current:{pending:false,completedId:'previous-slot'}};
  const reminder={id:'r',medicineName:'合成藥品',doseText:'依樣張'};let writes=0;
  const done=handler('app/caregiver/index.tsx','handleDonePress',{doneSubmissionRef,user:{uid:'care'},activePatientId:'p',activePatient:{patientsId:'synthetic'},currentReminder:reminder,activeSlot:{scheduleTime:'18:00',reminders:[reminder]},activeSlotDone:false,setDoneLoading:()=>{},medicationLogId:()=> 'next-slot',todayKey:'2026-10-25',db:{},doc:()=>({}),setDoc:async()=>{writes++},serverTimestamp:()=>0,Alert:{alert:(...a)=>alerts.push(a)},t:words,console:{log(){}}});
  await done();
  assert.equal(writes,1);assert.equal(alerts[0][1],'doneRecorded');
  assert.deepEqual(doneSubmissionRef.current,{pending:false,completedId:'next-slot'});
});
