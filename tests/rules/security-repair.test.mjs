import {before,after,beforeEach,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc} from 'firebase/firestore';
import {ref,uploadBytes,getBytes,deleteObject} from 'firebase/storage';
import {createEnv,seedUser,seedPatient,uid,PATIENT_ID} from './helpers.mjs';
let env;
const family=uid('repairfamily'),care=uid('repaircare'),other=uid('repairother');
before(async()=>{env=await createEnv({storage:true});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{
 await env.clearFirestore();
 for(const [id,role] of [[family,'family'],[care,'caregiver'],[other,'family']])await seedUser(env,id,role);
 await seedPatient(env,{families:[family],caregivers:[care]});
});
const storage=id=>env.authenticatedContext(id).storage();
const meta=(id,extra={})=>({contentType:'image/png',customMetadata:{uploaderUid:id,patientId:PATIENT_ID},...extra});
const bytes=new Uint8Array([137,80,78,71,13,10,26,10]);
test('legitimate caregiver path works even when caller is not a family member',async()=>{
 const image=randomUUID()+'.png',chat=`chats/${PATIENT_ID}/images/${image}`,rx=`prescriptions/${PATIENT_ID}/${care}/${image}`;
 await assertSucceeds(uploadBytes(ref(storage(family),chat),bytes,meta(family)));
 await assertSucceeds(getBytes(ref(storage(care),chat)));
 await assertSucceeds(uploadBytes(ref(storage(care),rx),bytes,meta(care)));
 await assertSucceeds(getBytes(ref(storage(family),rx)));
 for(const s of [storage(other),env.unauthenticatedContext().storage()]){
  await assertFails(getBytes(ref(s,chat)));await assertFails(getBytes(ref(s,rx)));
  await assertFails(uploadBytes(ref(s,rx),bytes,meta(care)));
 }
 await assertSucceeds(deleteObject(ref(storage(care),rx)));
 await assertSucceeds(deleteObject(ref(storage(family),chat)));
});
test('family image create/read/delete works; caregiver and unrelated family denied',async()=>{
 const p=`chats/${PATIENT_ID}/familyImages/${randomUUID()}.png`;
 await assertSucceeds(uploadBytes(ref(storage(family),p),bytes,meta(family)));
 await assertSucceeds(getBytes(ref(storage(family),p)));
 await assertFails(uploadBytes(ref(storage(family),p),bytes,meta(family)));
 for(const id of [care,other]){await assertFails(getBytes(ref(storage(id),p)));await assertFails(deleteObject(ref(storage(id),p)));}
 await assertSucceeds(deleteObject(ref(storage(family),p)));
});
test('pending deletion denies care uploads/reads and client cannot bypass with metadata',async()=>{
 const p=`chats/${PATIENT_ID}/images/${randomUUID()}.png`;
 await uploadBytes(ref(storage(family),p),bytes,meta(family));
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'_account_deletions',care),{status:'pending_deletion'}));
 await assertFails(getBytes(ref(storage(care),p)));
 await assertFails(uploadBytes(ref(storage(care),`prescriptions/${PATIENT_ID}/${care}/${randomUUID()}.png`),bytes,meta(care)));
 await assertFails(uploadBytes(ref(storage(family),`chats/${PATIENT_ID}/images/${randomUUID()}.png`),bytes,meta(family,{customMetadata:{uploaderUid:care,patientId:PATIENT_ID}})));
});
