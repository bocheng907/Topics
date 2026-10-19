// Targeted pre-push checks. Never prints matching credential contents.
const cp = require('node:child_process');
const git = (...args) => cp.execFileSync('git', args, {encoding:'utf8',maxBuffer:32*1024*1024});
const findings=[];
const patterns=[
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b(?=[^\n]*(?:secret|private))/i,
  /\bya29\.[A-Za-z0-9_-]{30,}/,
  /\b1\/\/[A-Za-z0-9_-]{50,}/,
  /"type"\s*:\s*"service_account"/,
];
function inspect(label,content){
  if(patterns.some(p=>p.test(content))) findings.push({label,reason:'credential-pattern'});
}
const files=git('diff','--cached','--name-only','--diff-filter=ACMR','-z').split('\0').filter(Boolean);
for(const file of files){
  if(/^(output|\.tmp-[^/]+|\.playwright-cli)\//.test(file)||/(^|\/)\.env(?!\.example$)/.test(file)||/\.(pem|key|p12|mp4|mov|m4a)$/.test(file))findings.push({label:file,reason:'private-or-generated-path'});
  inspect(file,git('show',':'+file));
}
const rows=git('rev-list','--objects','9cb3220ab6bd94b132c305e9820f2db5271c8aaa','--not','88fc42d3633592b9aa8cc8673ef9bbc453190ab0').trim().split('\n');
let historyBlobs=0;
for(const row of rows){
  const [oid,...path]=row.split(' ');
  if(!/\.(?:[cm]?[jt]sx?|json|md|rules|ya?ml|env|txt|py|ps1)$/.test(path.join(' ')))continue;
  if(git('cat-file','-t',oid).trim()!=='blob')continue;
  historyBlobs++;
  inspect('incoming-history:'+path.join(' '),git('cat-file','blob',oid));
}
console.log(JSON.stringify({scope:'High-confidence credential patterns only, not a comprehensive secret/security audit',stagedFiles:files.length,incomingHistoryBlobs:historyBlobs,findings},null,2));
if(findings.length)process.exitCode=1;
