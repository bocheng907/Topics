// Dedicated synthetic showcase registry. Never mixes existing users into the group.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const privateFile=path.join(root,'.env.showcase.local');
const projectId='smart-care-system-1a41e';
function state(){return JSON.parse(fs.readFileSync(privateFile,'utf8'));}
function save(s){fs.writeFileSync(privateFile,JSON.stringify(s,null,2),{mode:0o600});}
function prepare(){
 if(fs.existsSync(privateFile))return state();
 const id='care-week-'+crypto.randomUUID();
 const s={id,projectId,createdAt:new Date().toISOString(),actors:[
  {key:'family',name:'陳雅婷',role:'family'},
  {key:'brother',name:'陳志明',role:'family'},
  {key:'caregiver',name:'林怡君',role:'caregiver'},
 ].map(a=>({...a,email:`${a.key}.${id.slice(-12)}@example.com`,password:'Care9!'+crypto.randomBytes(20).toString('base64url')}))};
 save(s);return s;
}
async function admin(){
 if(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)throw Error('Unexpected emulator environment');
 const auth=require('C:/Users/boche/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth.js');
 const account=auth.getProjectDefaultAccount(root);
 if(!account||account.user.email!=='s112213082@mail1.ncnu.edu.tw')throw Error('Unexpected operator');
 const sdk=require('../functions/node_modules/firebase-admin');
 const app=sdk.apps.length?sdk.app():sdk.initializeApp({projectId,credential:{getAccessToken:async()=>{const t=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);return {access_token:t.access_token,expires_in:3600};}}});
 const cliApi=require('C:/Users/boche/AppData/Roaming/npm/node_modules/firebase-tools/lib/api.js');
 const {Firestore}=require('../functions/node_modules/@google-cloud/firestore');
 const db=new Firestore({projectId,credentials:{type:'authorized_user',client_id:cliApi.clientId(),client_secret:cliApi.clientSecret(),refresh_token:account.tokens.refresh_token}});
 return {db,auth:app.auth(),FieldValue:sdk.firestore.FieldValue,Timestamp:sdk.firestore.Timestamp};
}
async function identify(s,a){
 const api=await admin();const u=await api.auth.getUserByEmail(a.email);
 if(Date.parse(u.metadata.creationTime)<Date.parse(s.createdAt)-60000)throw Error('Refuse pre-existing account');
 if(a.uid&&a.uid!==u.uid)throw Error('UID changed');
 const q=await api.db.collection('users').where('uid','==',u.uid).get();
 if(q.size!==1)throw Error('Profile must be unique');
 a.uid=u.uid;a.profileId=q.docs[0].id;save(s);
 const claims=u.customClaims||{};if(Object.keys(claims).some(k=>k!=='showcaseId'))throw Error('Unexpected account claims');
 await api.auth.setCustomUserClaims(u.uid,{showcaseId:s.id});
 await api.db.doc('_showcase_groups/'+s.id).set({synthetic:true,purpose:'product walkthrough; not clinical records',createdAt:new Date(s.createdAt),updatedAt:api.FieldValue.serverTimestamp(),accountUids:s.actors.filter(a=>a.uid).map(a=>a.uid),source:'owner-authorized scripted UI',notificationIsolation:'dedicated accounts without push tokens'}, {merge:true});
 return api;
}
module.exports={root,state,save,prepare,admin,identify};
