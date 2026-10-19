// Read-only accounting of every incoming path; does not change Git or files.
const fs = require('node:fs');
const cp = require('node:child_process');
const incoming = '9cb3220ab6bd94b132c305e9820f2db5271c8aaa';
const original = '88fc42d3633592b9aa8cc8673ef9bbc453190ab0';
const git = (...args) => cp.execFileSync('git', ['-c', 'core.safecrlf=false', ...args], {encoding:'utf8'}).trim();
const base = git('merge-base', original, incoming);
const excluded = {
  'MODIFICATIONS_2026-09-22.md': 'Historical upstream release notes; current decisions/status supersede them.',
  'MODIFICATIONS_v5.3.md': 'Historical notes describe superseded public avatar.jpg rules.',
  'docs/gemini_ui_原型.tsx': 'Unused web-only prototype, not an App route; requires absent lucide-react dependency.',
  'docs/照顧者知識共享_功能規劃.md': 'Historical design proposal; implemented scope is documented in community-security-model.md.',
  'scripts/backfill-user-roles.cjs': 'Superseded by transactionally verified syncCommunityRole; no bulk live role overwrite.',
};
const keptRedirects = new Set(['app/family/camera.tsx','app/family/scan-result.tsx']);
const names = git('diff', '--name-only', '-z', base, incoming).split('\0').filter(Boolean);
const result = names.map(path => {
  if (excluded[path]) return {path, status:'deliberately-excluded', reason:excluded[path]};
  if (keptRedirects.has(path)) return {path,status:fs.existsSync(path)?'compatibility-redirect':'MISSING'};
  if (!fs.existsSync(path)) return {path,status:'MISSING'};
  const current = git('hash-object', '--path='+path, path);
  const upstream = git('rev-parse', incoming+':'+path);
  return {path,status:current===upstream?'upstream-identical':'integrated-with-local-behavior'};
});
console.log(JSON.stringify({original,incoming,base,paths:result.length,files:result},null,2));
if (result.some(r=>r.status==='MISSING')) process.exitCode=1;
