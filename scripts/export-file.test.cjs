/* global __dirname */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}});
  const output = {};
  new Function('require', 'exports', ...Object.keys(globals), compiled.outputText)(
    name => { if (!(name in dependencies)) throw new Error(name); return dependencies[name]; },
    output, ...Object.values(globals));
  return output;
}
const validation = load('src/export/exportPayload.ts');
const payload = () => ({
  filename: 'personal-data-5ca73254-ec5e-4460-850b-c24834c21a75.json',
  json: JSON.stringify({schemaVersion: 1, account: {uid: 'me'}, text: '中文資料'}),
  counts: {messages: 1}, skippedInaccessible: 0,
});
test('export payload accepts correct owner and UUID filename', () => {
  assert.doesNotThrow(() => validation.validateExportPayload(payload(), 'me'));
});
test('wrong owner, path traversal, malformed JSON and invalid counts rejected', () => {
  for (const data of [{...payload(), filename: '../file.json'}, {...payload(), json: '{}'},
    {...payload(), json: 'bad'}, {...payload(), counts: {x: -1}}, {...payload(), skippedInaccessible: -1}]) {
    assert.throws(() => validation.validateExportPayload(data, 'me'));
  }
  assert.throws(() => validation.validateExportPayload(payload(), 'other'));
});
function native({available = true, failWrite = false, failShare = false, cache = 'file:///cache/'} = {}) {
  const calls = [];
  const exports = load('src/export/saveExport.ts', {
    './exportPayload': validation,
    'expo-file-system/legacy': {cacheDirectory: cache, EncodingType: {UTF8: 'utf8'},
      writeAsStringAsync: async (...args) => { calls.push(['write', ...args]); if (failWrite) throw Error('write-failed'); },
      deleteAsync: async (...args) => { calls.push(['delete', ...args]); },
    },
    'expo-sharing': {isAvailableAsync: async () => available,
      shareAsync: async (...args) => { calls.push(['share', ...args]); if (failShare) throw Error('share-failed'); }},
  });
  return {...exports, calls};
}
test('native writes UTF-8 JSON, shares file, then removes only that cache file', async () => {
  const n = native(), p = payload();
  await n.saveExport(p, 'me');
  assert.deepEqual(n.calls.map(c => c[0]), ['write', 'share', 'delete']);
  assert.equal(n.calls[0][1], 'file:///cache/' + p.filename);
  assert.equal(n.calls[0][2], p.json);
  assert.equal(n.calls[1][2].mimeType, 'application/json');
  assert.equal(n.calls[2][1], n.calls[0][1]);
});
test('unsupported sharing and wrong owner never write a cache file', async () => {
  const n = native({available: false});
  await assert.rejects(n.saveExport(payload(), 'me'), /sharing-unavailable/);
  assert.equal(n.calls.length, 0);
  const other = native();
  await assert.rejects(other.saveExport(payload(), 'other'));
  assert.equal(other.calls.length, 0);
});
test('write and share failures still attempt scoped cache cleanup', async () => {
  for (const options of [{failWrite: true}, {failShare: true}]) {
    const n = native(options);
    await assert.rejects(n.saveExport(payload(), 'me'));
    assert.equal(n.calls.at(-1)[0], 'delete');
  }
});
test('web triggers UTF-8 JSON download and schedules Blob URL cleanup', async () => {
  const calls = [], timers = [];
  let capturedBlob;
  const anchor = {click() { calls.push('click'); }, remove() { calls.push('remove'); }};
  const web = load('src/export/saveExport.web.ts', {'./exportPayload': validation}, {
    document: {createElement: tag => { assert.equal(tag, 'a'); return anchor; },
      body: {appendChild: () => calls.push('append')}},
    URL: {createObjectURL: blob => { capturedBlob = blob; return 'blob:test'; },
      revokeObjectURL: url => calls.push('revoke:' + url)},
    Blob,
    setTimeout: fn => { timers.push(fn); },
  });
  const p = payload();
  await web.saveExport(p, 'me');
  assert.equal(anchor.download, p.filename);
  assert.equal(anchor.href, 'blob:test');
  assert.equal(await capturedBlob.text(), p.json);
  assert.deepEqual(calls, ['append', 'click', 'remove']);
  timers[0]();
  assert.equal(calls.at(-1), 'revoke:blob:test');
});
test('all four languages have a complete consistent set of messages', () => {
  const {exportCopy} = load('src/export/exportCopy.ts');
  for (const language of ['zh', 'en', 'vi', 'id']) {
    assert.deepEqual(Object.keys(exportCopy[language]).sort(), Object.keys(exportCopy.zh).sort());
    assert.ok(Object.values(exportCopy[language]).every(text => text.length > 0));
  }
});
test('both role menus and root route expose the export page', () => {
  for (const file of ['app/family/_layout.tsx', 'app/caregiver/_layout.tsx', 'app/_layout.tsx']) {
    assert.ok(fs.readFileSync(path.join(__dirname, '..', file), 'utf8').includes('personal-data-export'));
  }
});
