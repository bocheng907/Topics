// A narrow release: preserve live rules and append only the reviewed handbook block.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'output/handbook-release-20261016');
const project='smart-care-system-1a41e';
const norm=s=>s.replace(/\r\n/g,'\n').replace(/\n+$/,'');
async function main(){
 const auth=require('C:/Users/boche/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth.js');
 const a=auth.getProjectDefaultAccount(root);assert.equal(a?.user.email,'s112213082@mail1.ncnu.edu.tw');
 const t=await auth.getAccessToken(a.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
 const get=async u=>{const r=await fetch('https://firebaserules.googleapis.com/v1/'+u,{headers:{Authorization:'Bearer '+t.access_token}});if(!r.ok)throw Error('Rules read failed: '+r.status);return r.json();};
 async function live(){const release=await get(`projects/${project}/releases/cloud.firestore`);const rules=await get(release.rulesetName);assert.equal(rules.source.files.length,1);return {release,content:rules.source.files[0].content};}
 const before=fs.readFileSync(path.join(dir,'before.rules'),'utf8').replace(/\r\n/g,'\n'),after=fs.readFileSync(path.join(dir,'firestore.rules'),'utf8').replace(/\r\n/g,'\n'),block=fs.readFileSync(path.join(dir,'handbook-block.rules'),'utf8').replace(/\r\n/g,'\n');
 assert.equal(after.replace(block,''),before,'Only handbook change allowed');
 const pre=await live();
 if(norm(pre.content)!==norm(after)){
  assert.equal(norm(pre.content),norm(before),'Live rules changed; rebase and retest instead of overwriting');
  if(process.argv[2]!=='deploy'){console.log('Live baseline matches; ready for isolated deployment');return;}
  const result=spawnSync(process.execPath,['C:/Users/boche/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js','deploy','--only','firestore:rules','--project',project,'--config',path.join(dir,'firebase.json'),'--non-interactive'],{cwd:root,stdio:'inherit'});
  if(result.status!==0)throw Error('Deployment failed');
 }
 const post=await live();assert.equal(norm(post.content),norm(after),'Deployed source mismatch');
 const report={project,scope:'care_handbook only; all other live rules preserved',verifiedAt:new Date().toISOString(),ruleset:post.release.rulesetName,sha256:crypto.createHash('sha256').update(norm(post.content)).digest('hex')};
 fs.writeFileSync(path.join(dir,'deployment.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e.message?.slice(0,500));process.exit(1);});
