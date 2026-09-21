/* global __dirname */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {Buffer} = require('node:buffer');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.join(__dirname, '..');
const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'src/privacy/consent.ts'), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS},
});
const consent = {};
new Function('exports', compiled.outputText)(consent);
const version = consent.PRIVACY_POLICY_VERSION;
for (const [name, value, valid] of [
  ['missing', undefined, false], ['unchecked', {accepted: false, version}, false],
  ['wrong boolean type', {accepted: 'true', version}, false],
  ['missing version', {accepted: true}, false], ['old version', {accepted: true, version: 'old'}, false],
  ['current agreement', {accepted: true, version}, true],
]) test(`client: ${name}`, () => {
  if (valid) assert.doesNotThrow(() => consent.assertPrivacyConsent(value));
  else assert.throws(() => consent.assertPrivacyConsent(value), {code: 'privacy/consent-required'});
});

test('published document and Rules match consent version; no policy placeholders', () => {
  const url = new URL(consent.PRIVACY_POLICY_URL);
  const html = fs.readFileSync(path.join(root, 'privacy-hosting', `${url.pathname}.html`), 'utf8');
  assert.ok(html.includes(version));
  assert.ok(html.includes('暨南大學資管系,智慧醫療團隊'));
  assert.ok(html.includes('mailto:bocheng5204@gmail.com'));
  assert.ok(!html.includes('【待填】'));
  assert.ok(!html.includes('<script'));
  assert.ok(fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8').includes(`version == '${version}'`));
  for (const lang of ['zh', 'en', 'vi', 'id']) assert.ok(consent.privacyCopy[lang].consent);
});

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (host !== '127.0.0.1:8198') throw new Error('Use the local privacy-test emulator only');
const project = 'demo-invite-expiry';
const base = `http://${host}/v1/projects/${project}/databases/(default)/documents`;
const prefix = `projects/${project}/databases/(default)/documents`;
let sequence = 0;
function token(uid) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({alg: 'none', typ: 'JWT'})}.${encode({sub: uid, user_id: uid,
    aud: project, iss: `https://securetoken.google.com/${project}`,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
    firebase: {sign_in_provider: 'password'},
  })}.`;
}
function value(data) {
  if (data instanceof Date) return {timestampValue: data.toISOString()};
  if (typeof data === 'boolean') return {booleanValue: data};
  if (typeof data === 'object') return {mapValue: {fields: fields(data)}};
  return {stringValue: data};
}
function fields(data) { return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, value(v)])); }
function profile(withConsent = true) {
  return {uid: 'privacy-user', email: 'synthetic@example.invalid', role: 'caregiver', createdAt: new Date(),
    activePatientId: '', emergencyPhone1: '', emergencyPhone2: '',
    ...(withConsent ? {privacyConsent: {accepted: true, version, acceptedAt: new Date(0)}} : {}),
  };
}
async function request(url, uid, body, method = 'POST') {
  const response = await fetch(url, {method, headers: {
    'Content-Type': 'application/json', ...(uid ? {Authorization: `Bearer ${uid === 'ADMIN' ? 'owner' : token(uid)}`} : {}),
  }, ...(body ? {body: JSON.stringify(body)} : {})});
  return {status: response.status, body: await response.text()};
}
async function create(data, expected, transform = true, uid = 'privacy-user') {
  const name = `${prefix}/users/privacy_${process.pid}_${++sequence}`;
  const write = {update: {name, fields: fields(data)}, currentDocument: {exists: false}};
  if (transform && data.privacyConsent) {
    write.updateTransforms = [{fieldPath: 'privacyConsent.acceptedAt', setToServerValue: 'REQUEST_TIME'}];
  }
  const result = await request(`${base}:commit`, uid, {writes: [write]});
  assert.equal(result.status, expected, result.body);
}
test('Rules: current consent with server timestamp succeeds', () => create(profile(), 200));
test('Rules: no consent denied', () => create(profile(false), 403));
test('Rules: false consent denied', () => create({...profile(), privacyConsent: {accepted: false, version}}, 403));
test('Rules: string true denied', () => create({...profile(), privacyConsent: {accepted: 'true', version}}, 403));
test('Rules: wrong version denied', () => create({...profile(), privacyConsent: {accepted: true, version: 'old'}}, 403));
test('Rules: client timestamp denied', () => create(profile(), 403, false));
test('Rules: future timestamp denied', () => create({...profile(), privacyConsent: {accepted: true, version, acceptedAt: new Date(Date.now() + 86400000)}}, 403, false));
test('Rules: missing timestamp denied', () => create({...profile(), privacyConsent: {accepted: true, version}}, 403, false));
test('Rules: extraneous consent fields denied', () => create({...profile(), privacyConsent: {accepted: true, version, fabricated: true}}, 403));
test('Rules: unauthenticated profile creation denied', () => create(profile(), 403, true, null));
test('Rules: wrong owner denied', () => create(profile(), 403, true, 'other-user'));

async function update(change, expected, legacy = false, uid = 'privacy-user') {
  const data = profile(!legacy);
  const url = `${base}/users/privacy_${process.pid}_${++sequence}`;
  const seed = await request(url, 'ADMIN', {fields: fields(data)}, 'PATCH');
  assert.equal(seed.status, 200, seed.body);
  const after = change(data);
  const result = await request(url, uid, {fields: fields(after)}, 'PATCH');
  assert.equal(result.status, expected, result.body);
}
test('Rules: existing consent survives contact update', () => update(d => ({...d, emergencyPhone1: '123'}), 200));
test('Rules: legacy profile contact update still works', () => update(d => ({...d, emergencyPhone1: '123'}), 200, true));
test('Rules: consent version cannot change', () => update(d => ({...d, privacyConsent: {...d.privacyConsent, version: 'other'}}), 403));
test('Rules: consent timestamp cannot change', () => update(d => ({...d, privacyConsent: {...d.privacyConsent, acceptedAt: new Date()}}), 403));
test('Rules: consent cannot be removed', () => update(d => {delete d.privacyConsent; return d;}, 403));
test('Rules: legacy consent cannot be fabricated on update', () => update(d => ({...d, privacyConsent: profile().privacyConsent}), 403, true));
test('Rules: other user cannot edit consent', () => update(d => ({...d, emergencyPhone1: '123'}), 403, false, 'other-user'));
