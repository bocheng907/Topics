/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const source = read('firebase/uploadFilename.ts');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
function load(generate) {
  const exports = {};
  new Function('require', 'exports', compiled.outputText)(name => {
    assert.equal(name, 'expo-crypto');
    return { randomUUID: generate };
  }, exports);
  return exports.createImageUploadFilename;
}
test('preserves UUID and jpg extension', () => {
  const id = '5ca73254-ec5e-4460-850b-c24834c21a75';
  assert.equal(load(() => id)(), id + '.jpg');
});
test('requests fresh UUID on every upload', () => {
  let calls = 0;
  const generate = load(() => { calls++; return randomUUID(); });
  const names = Array.from({ length: 1000 }, generate);
  assert.equal(calls, 1000);
  assert.equal(new Set(names).size, 1000);
  for (const name of names) {
    assert.match(name, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/);
  }
});
test('crypto failure does not fall back to predictable names', () => {
  assert.throws(load(() => { throw new Error('crypto unavailable'); }), /crypto unavailable/);
});
for (const file of ['firebase/uploadPrescriptionImage.ts', 'app/family/chat-room.tsx', 'app/caregiver/chat-room.tsx']) {
  test(file + ' uses shared UUID filename generator', () => {
    const text = read(file);
    assert.match(text, /createImageUploadFilename\(\)/);
    assert.doesNotMatch(text, /Date\.now\(\)/);
  });
}
