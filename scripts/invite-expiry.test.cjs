/* global __dirname */
const {Buffer} = require('node:buffer');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Only this local demo emulator is allowed; never use production credentials.
const project = 'demo-invite-expiry';
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!['127.0.0.1:8189', '127.0.0.1:8198'].includes(host)) throw new Error('Run with the invite-test or privacy-test emulator configuration');
const base = `http://${host}/v1/projects/${project}/databases/(default)/documents`;
const day = 86400000;
const source = fs.readFileSync(path.join(__dirname, '../src/care-target/inviteExpiry.ts'), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}});
const exportsObject = {};
new Function('exports', compiled.outputText)(exportsObject);

test('UI: start, just before expiry, exact expiry, after expiry, future, invalid', () => {
  const {isInviteActive: active} = exportsObject;
  const issued = 100000000;
  const stamp = {toMillis: () => issued};
  for (const [value, now, expected] of [
    [stamp, issued, true], [stamp, issued + day - 1, true],
    [stamp, issued + day, false], [stamp, issued + day + 1, false],
    [stamp, issued - 1, false], [null, issued, false],
    ['invalid', issued, false], [{toMillis: () => NaN}, issued, false],
  ]) assert.equal(active(value, now), expected);
});

function token(uid) {
  const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${encode({alg: 'none', typ: 'JWT'})}.${encode({
    sub: uid, user_id: uid, aud: project, iss: `https://securetoken.google.com/${project}`,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
    firebase: {sign_in_provider: 'password'},
  })}.`;
}
function fields(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key,
    value instanceof Date ? {timestampValue: value.toISOString()} :
      Array.isArray(value) ? {arrayValue: {values: value.map(item => ({stringValue: item}))}} :
        {stringValue: value},
  ]));
}
function patient(age = 0) {
  return {patientsId: 'TEST1234', name: 'Synthetic test', notes: '', inviteCode: 'ABC234',
    createdAt: new Date(Date.now() - age), createdBy: 'owner', families: ['owner'],
    caregivers: [], emergencyPhone1: '', emergencyPhone2: ''};
}
let sequence = 0;
async function attempt(before, change, uid = 'joiner', expected = 403) {
  const id = `expiry_${process.pid}_${++sequence}`;
  const url = `${base}/patients/${id}`;
  const seed = await fetch(url, {method: 'PATCH', headers: {
    Authorization: 'Bearer owner', 'Content-Type': 'application/json',
  }, body: JSON.stringify({fields: fields(before)})});
  assert.equal(seed.status, 200, await seed.text());
  const after = {...before, ...change};
  const response = await fetch(url, {method: 'PATCH', headers: {
    ...(uid ? {Authorization: `Bearer ${token(uid)}`} : {}), 'Content-Type': 'application/json',
  }, body: JSON.stringify({fields: fields(after)})});
  assert.equal(response.status, expected, await response.text());
}

test('Rules: direct family join denied even during window', () => attempt(patient(60000), {families: ['owner', 'joiner']}));
test('Rules: direct caregiver join denied even during window', () => attempt(patient(60000), {caregivers: ['joiner']}));
test('Rules: direct join denied near deadline', () => attempt(patient(day - 10000), {caregivers: ['joiner']}));
test('Rules: 24 hours elapsed is denied', () => attempt(patient(day), {caregivers: ['joiner']}));
test('Rules: expired is denied', () => attempt(patient(day + 60000), {families: ['owner', 'joiner']}));
test('Rules: future createdAt is denied', () => attempt(patient(-60000), {caregivers: ['joiner']}));
test('Rules: missing createdAt is denied', () => {
  const data = patient(); delete data.createdAt;
  return attempt(data, {caregivers: ['joiner']});
});
test('Rules: invalid timestamp type is denied', () => attempt({...patient(), createdAt: 'invalid'}, {caregivers: ['joiner']}));
test('Rules: reset expired timestamp cannot bypass', () => attempt(patient(day + 60000), {createdAt: new Date(), caregivers: ['joiner']}));
test('Rules: owner cannot extend timestamp', () => attempt(patient(day + 60000), {createdAt: new Date()}, 'owner'));
test('Rules: owner cannot replace invite code', () => attempt(patient(), {inviteCode: 'NEW234'}, 'owner'));
test('Rules: cannot add another UID', () => attempt(patient(), {caregivers: ['someone-else']}));
test('Rules: cannot modify both membership lists', () => attempt(patient(), {families: ['owner', 'joiner'], caregivers: ['joiner']}));
test('Rules: cannot change profile while joining', () => attempt(patient(), {families: ['owner', 'joiner'], name: 'changed'}));
test('Rules: cannot remove existing owner', () => attempt(patient(), {families: ['joiner']}));
test('Rules: unauthenticated joining denied', () => attempt(patient(), {caregivers: ['joiner']}, null));
test('Rules: existing member can edit contacts after expiry', () => attempt(patient(day * 2), {emergencyPhone1: '123'}, 'owner', 200));
test('Rules: outsider cannot edit profile after expiry', () => attempt(patient(day * 2), {emergencyPhone1: '123'}));
test('Rules: existing member cannot bypass expiry to add someone', () => attempt(patient(day * 2), {families: ['owner', 'joiner']}, 'owner'));

test('Rules: direct creation denied even with server timestamp', async () => {
  for (const serverTimestamp of [true, false]) {
    const data = patient();
    if (serverTimestamp) delete data.createdAt;
    else data.createdAt = new Date(Date.now() + day);
    const write = {update: {name: `projects/${project}/databases/(default)/documents/patients/create_${process.pid}_${++sequence}`, fields: fields(data)}};
    if (serverTimestamp) write.updateTransforms = [{fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME'}];
    const result = await fetch(`${base}:commit`, {method: 'POST', headers: {
      Authorization: `Bearer ${token('owner')}`, 'Content-Type': 'application/json',
    }, body: JSON.stringify({writes: [write]})});
    assert.equal(result.status, 403, await result.text());
  }
});
