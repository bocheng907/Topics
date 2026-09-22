const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpile(fs.readFileSync('src/export/exportDiagnostic.ts', 'utf8'),
    {module: ts.ModuleKind.CommonJS}), {exports: exportsObject});
const {exportDiagnostic: diagnose, exportDiagnosticHint: hint} = exportsObject;
test('identifies profile, rate and integrity failures', () => {
  for (const [message, reason] of [['Unique profile required.', 'profile'],
    ['Export rate limit reached.', 'rate'], ['invalid-export', 'payload'],
    ['Recent authentication is required.', 'recent-auth']]) {
    assert.equal(diagnose({message}, 'request').reason, reason);
    assert.ok(hint(reason, 'zh'));
  }
});
test('does not leak raw errors, identifiers or URLs', () => {
  const data = diagnose({code: 'secret-uid', message: 'https://secret/password', details: {token: 'private'}}, 'save');
  assert.equal(data.id, 'EXPORT/save/unknown/unknown');
  assert.ok(!JSON.stringify(data).includes('secret'));
  assert.equal(diagnose({message: 'toString'}, 'request').reason, 'unknown');
});
test('network and stage remain distinguishable', () => {
  assert.equal(diagnose({code: 'auth/network-request-failed'}, 'reauth').reason, 'network');
  assert.match(diagnose(null, 'validate').id, /^EXPORT\/validate\//);
});
