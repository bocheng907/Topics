const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve(__dirname, '../output/caregiver-exception-checks-20261025');
fs.mkdirSync(out, { recursive: true });
for (const script of ['reliability-browser.cjs', 'registration-exception-browser.cjs', 'chat-offline-browser.cjs']) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], { encoding: 'utf8', timeout: 360000, env: process.env });
  fs.writeFileSync(path.join(out, script + '.log'), (result.stdout || '') + (result.stderr || '') + (result.error?.message || ''));
  console.log(script, result.status, result.stdout, result.stderr);
  if (result.status !== 0) process.exitCode = 1;
}
