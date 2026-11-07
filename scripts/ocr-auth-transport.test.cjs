const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(auth) {
  const result = {};
  const source = fs.readFileSync(require.resolve('../src/api/analyzePrescription.ts'), 'utf8');
  new Function('exports', 'require', ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(result,
    name => name === 'expo-constants' ? {default:{}} : {auth});
  return result;
}
test('OCR and translation send login token only through HTTPS without redirects', async () => {
  const original = global.fetch;
  const auth = {currentUser:{uid:'alice',getIdToken:async ()=>'private-test-token'}};
  const {requestServiceJson} = load(auth);
  const calls = [];
  global.fetch = async (url, init) => {calls.push({url,init}); return {ok:true,text:async ()=>'{}'};};
  try {
    for (const [path,service] of [['/analyze/url','ocr'],['/translate','translation'],['/translate/batch','translation']]) {
      await requestServiceJson('https://example.invalid'+path, {}, service, 1000);
    }
    assert.equal(calls.length, 3);
    assert.ok(calls.every(c => c.init.headers.Authorization === 'Bearer private-test-token' && c.init.redirect === 'error'));
    await assert.rejects(requestServiceJson('http://13.115.221.47:8080/translate', {}, 'translation', 1000), {code:'translation/unavailable'});
    auth.currentUser = null;
    await assert.rejects(requestServiceJson('https://example.invalid/translate', {}, 'translation', 1000), {code:'translation/unauthenticated'});
    assert.equal(calls.length, 3);
  } finally { global.fetch = original; }
});
test('sign-out and cancellation during token refresh prevent the outgoing request', async () => {
  const original = global.fetch;
  let release;
  const auth = {currentUser:{uid:'alice',getIdToken:() => new Promise(resolve => {release=resolve;})}};
  const {requestServiceJson} = load(auth);
  let calls=0;
  global.fetch = async () => {calls++;};
  try {
    const pending = requestServiceJson('https://example.invalid/translate', {}, 'translation', 1000);
    auth.currentUser = null;
    release('token');
    await assert.rejects(pending, {code:'translation/unauthenticated'});
    assert.equal(calls,0);
  } finally { global.fetch=original; }
});

test('only the approved HTTP service can be used without sending credentials', async () => {
  const original = global.fetch;
  const auth = {currentUser:{uid:'alice',getIdToken:async () => {throw new Error('HTTP must not request a token');}}};
  const {requestServiceJson} = load(auth);
  const calls = [];
  global.fetch = async (url, init) => {calls.push({url,init}); return {ok:true,text:async ()=>'{}'};};
  try {
    const origin = 'http://123.195.84.227:8080';
    for (const [path, service] of [['/analyze/url','ocr'], ['/translate','translation'], ['/translate/batch','translation']]) {
      await requestServiceJson(origin + path, {value:'synthetic'}, service, 1000);
    }
    assert.equal(calls.length, 3);
    assert.ok(calls.every(c => !('Authorization' in c.init.headers)));
    assert.ok(calls.every(c => c.init.credentials === 'omit' && c.init.redirect === 'error'));
    for (const url of [
      'http://123.195.84.227:8000/translate',
      'http://123.195.84.228:8080/translate',
      'http://user@123.195.84.227:8080/translate',
      'http://123.195.84.227:8080@other.invalid/translate',
    ]) {
      await assert.rejects(requestServiceJson(url, {}, 'translation', 1000), {code:'translation/unavailable'});
    }
    auth.currentUser = null;
    await assert.rejects(requestServiceJson(origin + '/translate', {}, 'translation', 1000), {code:'translation/unauthenticated'});
    assert.equal(calls.length, 3);
  } finally { global.fetch = original; }
});

test('OCR and both translation operations use the configured HTTP service', async () => {
  const originalFetch = global.fetch;
  const previousUrl = process.env.EXPO_PUBLIC_PRESCRIPTION_API_BASE_URL;
  const auth = {currentUser:{uid:'alice',getIdToken:async () => {throw new Error('HTTP must not request a token');}}};
  process.env.EXPO_PUBLIC_PRESCRIPTION_API_BASE_URL = 'http://123.195.84.227:8080';
  const {analyzePrescriptionByUrl, translateText, translateTexts} = load(auth);
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({url,init});
    const result = url.endsWith('/analyze/url') ? {medicines:[]} :
      url.endsWith('/translate/batch') ? {translations:[{key:'a',translated_text:'hello'}]} :
      {translated_text:'hello'};
    return {ok:true,text:async () => JSON.stringify(result)};
  };
  try {
    assert.deepEqual(await analyzePrescriptionByUrl('synthetic-image-url'), {medicines:[]});
    assert.equal((await translateText('hello','English')).translated_text, 'hello');
    assert.equal((await translateTexts([{key:'a',text:'hello'}],'English')).translations[0].key, 'a');
    assert.deepEqual(calls.map(c => new URL(c.url).pathname), ['/analyze/url','/translate','/translate/batch']);
    assert.ok(calls.every(c => !('Authorization' in c.init.headers)));
  } finally {
    global.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_PRESCRIPTION_API_BASE_URL;
    else process.env.EXPO_PUBLIC_PRESCRIPTION_API_BASE_URL = previousUrl;
  }
});
