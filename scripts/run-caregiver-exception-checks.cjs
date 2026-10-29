// Local demo projects only. Does not deploy, read production, or send real notifications.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'output', 'caregiver-exception-checks-20261025');
const cli = process.env.FIREBASE_CLI_PATH || path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/bin/firebase.js');
const groups = [
  {name:'unit', files:['functions/accountDeletion.test.js','functions/healthThresholds.test.js','functions/careTargetAccess.test.js','scripts/registration-account.test.cjs','scripts/registration-error.test.cjs','scripts/password-policy.test.cjs','scripts/medication-progress.test.cjs','scripts/local-media.test.cjs','scripts/chat-ui-regression.test.cjs']},
  {name:'access', project:'demo-invite-expiry', config:'firebase.agency-test.json', only:'firestore', files:['scripts/privacy-consent.test.cjs','scripts/invite-expiry.test.cjs','scripts/care-target-access.test.cjs','scripts/agency-integration.test.cjs','scripts/extended-flows.test.cjs']},
  {name:'leave', project:'demo-handbook-release', config:'firebase.leave-test.json', only:'firestore', files:['scripts/care-leave.test.cjs']},
  {name:'reliability', project:'demo-care-walkthrough', config:'firebase.walkthrough.json', only:'auth,firestore', files:['scripts/reliability.test.cjs']},
  {name:'behavior', project:'demo-care-walkthrough', config:'firebase.walkthrough.json', only:'auth,firestore', files:['scripts/caregiver-exception-behavior.test.cjs','scripts/medication-progress.test.cjs']},
];
fs.mkdirSync(out, {recursive:true});
const results=[];
for (const group of groups) {
  if (process.argv[2] && process.argv[2]!==group.name) continue;
  const env={...process.env, JAVA_TOOL_OPTIONS:'-XX:+UseSerialGC -Xms16m -Xmx384m', FIREBASE_CLI_DISABLE_TELEMETRY:'1'};
  delete env.GOOGLE_APPLICATION_CREDENTIALS;
  delete env.FIREBASE_TOKEN;
  delete env.FIRESTORE_EMULATOR_HOST;
  delete env.FIREBASE_AUTH_EMULATOR_HOST;
  delete env.GCLOUD_PROJECT;
  const testArgs=['--test','--test-concurrency=1',...group.files];
  const args=group.project?[cli,'emulators:exec','--config',group.config,'--only',group.only,'--project',group.project,'node '+testArgs.join(' ')]:testArgs;
  console.log('START '+group.name+' (isolated)');
  const result=spawnSync(process.execPath,args,{cwd:root,env,encoding:'utf8',timeout:300000,maxBuffer:30*1024*1024});
  const output=(result.stdout||'')+'\n'+(result.stderr||'');
  fs.writeFileSync(path.join(out,group.name+'.log'),output);
  const counts={};
  for(const key of ['tests','pass','fail','skipped'])counts[key]=Number(output.match(new RegExp('^# '+key+' (\\d+)','m'))?.[1]||0);
  const summary={name:group.name,exit:result.status,error:result.error?.message,...counts};
  results.push(summary);
  console.log(JSON.stringify(summary));
  if(result.status!==0) console.log(output.slice(-6500));
}
fs.writeFileSync(path.join(out,(process.argv[2]||'all')+'-summary.json'),JSON.stringify(results,null,2));
if(results.some(r=>r.exit!==0))process.exitCode=1;
