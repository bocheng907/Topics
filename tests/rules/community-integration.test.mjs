import {before,after,beforeEach,test} from 'node:test';
import {assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,query,where,writeBatch,serverTimestamp,increment,updateDoc,deleteDoc} from 'firebase/firestore';
import {createEnv,seedUser,authed,uid,userDocId,registrationPayload} from './helpers.mjs';
import {ref,uploadBytes,getBytes} from 'firebase/storage';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {Firestore}=require('../../functions/node_modules/@google-cloud/firestore');
const {createSyncCommunityRole}=require('../../functions/communityRole');
const adminDb=new Firestore({projectId:'demo-rules-test'});
const syncRole=createSyncCommunityRole(adminDb);
const owner=uid('owner'),other=uid('other'),agency=uid('agency'),care=uid('care');
let env;
before(async()=>{env=await createEnv({storage:true});});
after(async()=>{await env?.cleanup();await adminDb.terminate();});
beforeEach(async()=>{
 await env.clearFirestore();
 for(const [id,role] of [[owner,'family'],[other,'family'],[agency,'agency'],[care,'caregiver']])await seedUser(env,id,role);
 await setDoc(doc(authed(env,owner),'posts','p'),{category:'照護技巧',title:'照護',content:'日常紀錄',preview:'紀錄',authorUid:owner,authorName:'家屬',createdAt:serverTimestamp(),updatedAt:serverTimestamp(),viewCount:0,commentCount:0,likeCount:0,reportCount:0,status:'published',imageUrls:[]});
});
function comment(db,id='c'){
 const b=writeBatch(db);
 b.set(doc(db,'posts','p','comments',id),{postId:'p',content:'收到',authorUid:other,authorName:'家屬',createdAt:serverTimestamp(),likeCount:0});
 b.update(doc(db,'posts','p'),{commentCount:increment(1),lastCommentId:id});return b;
}
test('family and agency read; caregiver and unauthenticated denied',async()=>{
 await assertSucceeds(getDoc(doc(authed(env,agency),'posts','p')));
 await assertFails(getDoc(doc(authed(env,care),'posts','p')));
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'posts','p')));
});
test('comment count requires exact atomic action and reverse check',async()=>{
 const db=authed(env,other);
 await assertFails(updateDoc(doc(db,'posts','p'),{commentCount:increment(1),lastCommentId:'fake'}));
 await assertSucceeds(comment(db).commit());
 await assertFails(deleteDoc(doc(db,'posts','p','comments','c')));
 const b=writeBatch(db);b.delete(doc(db,'posts','p','comments','c'));b.update(doc(db,'posts','p'),{commentCount:increment(-1),lastCommentId:'c'});await assertSucceeds(b.commit());
});
test('multiple comments cannot share one increment',async()=>{
 const db=authed(env,other),b=comment(db);
 b.set(doc(db,'posts','p','comments','second'),{postId:'p',content:'x',authorUid:other,authorName:'family',createdAt:serverTimestamp(),likeCount:0});
 await assertFails(b.commit());
});
test('hidden posts and comments author only; queries scoped',async()=>{
 await comment(authed(env,other)).commit();
 await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'posts','p'),{status:'hidden'}));
 for(const id of [other,agency,care]){
  await assertFails(getDoc(doc(authed(env,id),'posts','p')));
  await assertFails(getDocs(collection(authed(env,id),'posts','p','comments')));
 }
 await assertSucceeds(getDoc(doc(authed(env,owner),'posts','p')));
 await assertSucceeds(getDocs(collection(authed(env,owner),'posts','p','comments')));
 await assertSucceeds(getDocs(query(collection(authed(env,other),'posts'),where('status','==','published'))));
 await assertSucceeds(getDocs(query(collection(authed(env,owner),'posts'),where('authorUid','==',owner))));
 await assertFails(getDocs(collection(authed(env,other),'posts')));
});
test('orphaned comments inaccessible',async()=>{
 await comment(authed(env,other)).commit();await deleteDoc(doc(authed(env,owner),'posts','p'));
 await assertFails(getDocs(collection(authed(env,owner),'posts','p','comments')));
});
test('mapping cannot change role or point at another owner',async()=>{
 await assertFails(updateDoc(doc(authed(env,care),'user_roles',care),{role:'family',updatedAt:serverTimestamp()}));
 const fresh=uid('fresh');await seedUser(env,fresh,'family',{withRole:false});
 await assertFails(setDoc(doc(authed(env,fresh),'user_roles',fresh),{uid:fresh,role:'family',userDocId:userDocId(owner),updatedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(authed(env,fresh),'user_roles',fresh),{uid:fresh,role:'family',userDocId:userDocId(fresh),updatedAt:serverTimestamp()}));
 await syncRole({auth:{uid:fresh}});
});
test('post ownership, schema and counters immutable outside actions',async()=>{
 const p=doc(authed(env,owner),'posts','p');
 for(const data of [{authorUid:other},{title:''},{content:'x'.repeat(20001)},{likeCount:-1},{extra:true},{status:'hidden'}]) await assertFails(updateDoc(p,data));
 await assertSucceeds(updateDoc(p,{title:'更新',updatedAt:serverTimestamp()}));
});
test('registration followed by server mapping blocks second profile',async()=>{
 const fresh=uid('new'),db=authed(env,fresh);
 await assertSucceeds(setDoc(doc(db,'users',userDocId(fresh)),registrationPayload(fresh,'family',{displayName:'Family',privacyConsent:{accepted:true,version:'2026-09-22.v2',acceptedAt:serverTimestamp()}})));
 await syncRole({auth:{uid:fresh}});
 await assertFails(setDoc(doc(db,'users','another'),registrationPayload(fresh,'agency',{displayName:'Agency',privacyConsent:{accepted:true,version:'2026-09-22.v2',acceptedAt:serverTimestamp()}})));
});

test('legacy duplicate profiles cannot bootstrap a different role',async()=>{
 const fresh=uid('duplicate');await seedUser(env,fresh,'caregiver',{withRole:false});
 await assertSucceeds(setDoc(doc(authed(env,fresh),'users','duplicate-family'),registrationPayload(fresh,'family',{displayName:'Family',privacyConsent:{accepted:true,version:'2026-09-22.v2',acceptedAt:serverTimestamp()}})));
 const assert=await import('node:assert/strict');
 await assert.rejects(()=>syncRole({auth:{uid:fresh},data:{role:'family'}}),{code:'failed-precondition'});
 await assertFails(getDoc(doc(authed(env,fresh),'posts','p')));
});

test('server role bootstrap rejects unauthenticated, pending and forged role',async()=>{
 const assert=await import('node:assert/strict');
 await assert.rejects(()=>syncRole({}),{code:'unauthenticated'});
 const fresh=uid('pending');await seedUser(env,fresh,'family',{withRole:false,extra:{accountStatus:'pending_deletion'}});
 await assert.rejects(()=>syncRole({auth:{uid:fresh}}),{code:'permission-denied'});
 const result=await syncRole({auth:{uid:care},data:{role:'family',userDocId:userDocId(owner)}});
 assert.equal(result.role,'caregiver');
 await syncRole({auth:{uid:care}});
 await assertFails(getDoc(doc(authed(env,care),'posts','p')));
});
test('three distinct reports hide and author cannot unhide',async()=>{
 for(const id of [other,agency,owner]){
  const db=authed(env,id),snap=await getDoc(doc(db,'posts','p')),next=snap.data().reportCount+1,b=writeBatch(db);
  b.set(doc(db,'reports','p_by_'+id),{postId:'p',reporterUid:id,reason:'其他',detail:'',createdAt:serverTimestamp()});
  b.update(doc(db,'posts','p'),{reportCount:increment(1),...(next>=3?{status:'hidden'}:{})});
  await assertSucceeds(b.commit());
 }
 await assertFails(getDoc(doc(authed(env,other),'posts','p')));
 await assertFails(updateDoc(doc(authed(env,owner),'posts','p'),{status:'published'}));
});
test('view count cannot replay inside 24h; likes need tracking',async()=>{
 const db=authed(env,other);
 const view=()=>{const b=writeBatch(db);b.set(doc(db,'posts','p','views',other),{lastViewedAt:serverTimestamp()});b.update(doc(db,'posts','p'),{viewCount:increment(1)});return b.commit();};
 await assertSucceeds(view());await assertFails(view());
 await assertFails(setDoc(doc(db,'posts','p','likes',other),{createdAt:serverTimestamp()}));
 const b=writeBatch(db);b.set(doc(db,'posts','p','likes',other),{createdAt:serverTimestamp()});b.update(doc(db,'posts','p'),{likeCount:increment(1)});await assertSucceeds(b.commit());
});
test('community image SDK visibility follows hidden parent and role',async()=>{
 const path=`community_posts/${owner}/p/12345678-1234-4234-8234-123456789abc.jpg`;
 const storage=id=>env.authenticatedContext(id).storage();
 await assertSucceeds(uploadBytes(ref(storage(owner),path),new Uint8Array([1,2,3]),{contentType:'image/jpeg',customMetadata:{uploaderUid:owner,postId:'p'}}));
 await assertSucceeds(getBytes(ref(storage(other),path)));
 await assertFails(getBytes(ref(storage(care),path)));
 await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'posts','p'),{status:'hidden'}));
 await assertFails(getBytes(ref(storage(other),path)));
 await assertSucceeds(getBytes(ref(storage(owner),path)));
});
