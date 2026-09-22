/* global __dirname */
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const {Buffer} = require('node:buffer');
const {randomBytes} = require('node:crypto');
const requireFunctions = require('node:module').createRequire(
  require('node:path').join(__dirname, '../functions/package.json'));
const {initializeApp, deleteApp} = requireFunctions('firebase-admin/app');
const {getFirestore, Timestamp} = requireFunctions('firebase-admin/firestore');
const {createCareTargetService} = require('../functions/careTargetAccess');
const fs = require('node:fs');
const path = require('node:path');

// Never attach this synthetic test suite to a real project.
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8198') {
  throw new Error('Use firebase.privacy-test.json and the local emulator only');
}
const project = 'demo-invite-expiry';
const app = initializeApp({projectId: project}, 'access-tests');
const db = getFirestore(app);
const base = 'http://127.0.0.1:8198/v1/projects/' + project + '/databases/(default)/documents';
after(async () => { await db.terminate(); await deleteApp(app); });
function token(uid) {
  const enc = data => Buffer.from(JSON.stringify(data)).toString('base64url');
  return enc({alg: 'none', typ: 'JWT'}) + '.' + enc({
    sub: uid, user_id: uid, aud: project,
    iss: 'https://securetoken.google.com/' + project,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
    firebase: {sign_in_provider: 'password'},
  }) + '.';
}
async function rest(url, uid, expected, body, method = 'POST') {
  const response = await fetch(base + url, {method,
    headers: {'Content-Type': 'application/json', ...(uid ? {Authorization: 'Bearer ' + token(uid)} : {})},
    ...(body ? {body: JSON.stringify(body)} : {}),
  });
  const value = await response.json();
  assert.equal(response.status, expected, JSON.stringify(value));
  return value;
}
function query(collectionId, field, op, value) {
  return {structuredQuery: {from: [{collectionId}], ...(field ? {
    where: {fieldFilter: {field: {fieldPath: field}, op, value: {stringValue: value}}},
  } : {})}};
}
async function patchDoc(docPath, uid, data, expected) {
  const fields = Object.fromEntries(Object.entries(data).map(([key, v]) => [key,
    Array.isArray(v) ? {arrayValue: {values: v.map(x => ({stringValue: x}))}} :
      typeof v === 'number' ? {doubleValue: v} : {stringValue: v},
  ]));
  return rest('/' + docPath + '?' + Object.keys(data).map(k =>
    'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&'), uid, expected, {fields}, 'PATCH');
}
async function fixture() {
  const id = randomBytes(6).toString('hex');
  const owner = 'owner-' + id, care = 'care-' + id, outsider = 'out-' + id;
  const patientId = 'patient-' + id, recordId = 'health-' + id;
  const inviteCode = randomBytes(3).toString('hex').toUpperCase();
  let now = Date.now();
  const patient = {patientsId: id.toUpperCase(), name: 'Synthetic elder', notes: '',
    inviteCode, createdAt: Timestamp.fromMillis(now - 1000), createdBy: owner,
    families: [owner], caregivers: [care], emergencyPhone1: '', emergencyPhone2: ''};
  const health = {patientId, caregiverId: care, createdAt: Timestamp.now(), temperature: 36.5};
  const batch = db.batch();
  batch.set(db.doc('patients/' + patientId), patient);
  batch.set(db.doc('health_records/' + recordId), health);
  for (const [uid, role] of [[owner, 'family'], [care, 'caregiver'], [outsider, 'caregiver']]) {
    batch.set(db.doc('users/profile-' + uid), {uid, role, emergencyPhone1: '', emergencyPhone2: ''});
  }
  await batch.commit();
  return {owner, care, outsider, patientId, recordId, inviteCode, patient,
    service: createCareTargetService(db, () => now),
    advance: ms => { now += ms; }};
}
const req = (uid, data) => ({auth: {uid}, data});

test('primary role cannot be forged; secondary family and caregiver cannot mutate prescriptions', async () => {
  const f = await fixture();
  await db.doc('patients/' + f.patientId).update({families: [f.owner, f.outsider]});
  await db.doc('users/profile-' + f.outsider).update({role: 'family'});
  const path = 'prescriptions/rbac-' + f.patientId;
  await db.doc(path).set({patientId: f.patientId, createdBy: f.owner, createdAt: Timestamp.now(), title: 'Synthetic'});
  await db.doc(path + '/items/i').set({drug_name: 'Synthetic'});
  for (const uid of [f.outsider, f.care]) {
    await rest('/' + path, uid, 200, null, 'GET');
    await patchDoc(path, uid, {title: 'Forbidden'}, 403);
    await patchDoc(path + '/items/i', uid, {drug_name: 'Forbidden'}, 403);
    await rest('/' + path, uid, 403, null, 'DELETE');
    await patchDoc('patients/' + f.patientId, uid, {primaryFamilyUid: uid}, 403);
    await assert.rejects(f.service.manageInvitation(req(uid, {patientId: f.patientId, action: 'regenerate'})), {code: 'permission-denied'});
  }
  await patchDoc(path, f.owner, {title: 'Allowed'}, 200);
  await patchDoc(path + '/items/i', f.owner, {drug_name: 'Allowed'}, 200);
  await db.doc('patients/' + f.patientId).update({primaryFamilyUid: ''});
  await patchDoc(path, f.owner, {title: 'No fallback'}, 403);
  await assert.rejects(f.service.manageInvitation(req(f.owner, {patientId: f.patientId, action: 'get'})), {code: 'permission-denied'});
});

test('caregiver creates prescription, items and reminders atomically but cannot modify them later', async () => {
  const f = await fixture();
  const name = p => `projects/${project}/databases/(default)/documents/${p}`;
  const str = value => ({stringValue: value});
  const rx = 'prescriptions/new-' + f.patientId;
  const reminder = 'medication_reminders/new-' + f.patientId;
  const fields = {patientId: str(f.patientId), createdBy: str(f.care), title: str('Synthetic')};
  const reminders = {patientId: str(f.patientId), prescriptionId: str('new-' + f.patientId),
    notifyUserIds: {arrayValue: {values: [str(f.owner), str(f.care)]}}};
  const write = (p, data, stamp = false) => ({update: {name: name(p), fields: data},
    ...(stamp ? {updateTransforms: [{fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME'}]} : {})});
  await rest(':commit', f.care, 200, {writes: [write(rx, fields, true),
    write(rx + '/items/i', {drug_name: str('Synthetic')}), write(reminder, reminders, true)]});
  assert.equal((await db.doc(rx).get()).data().createdBy, f.care);
  assert.equal((await db.doc(reminder).get()).data().patientId, f.patientId);
  for (const p of [rx, rx + '/items/i', reminder]) {
    await patchDoc(p, f.care, {title: 'Forbidden'}, 403);
    await rest('/' + p, f.care, 403, null, 'DELETE');
  }
  await rest(':commit', f.care, 403, {writes: [write(rx + '/items/extra', {drug_name: str('Forbidden')})]});
  await rest(':commit', f.care, 403, {writes: [write(reminder + '-extra', reminders, true)]});
  await patchDoc(rx, f.owner, {title: 'Primary edit'}, 200);
  await db.doc('patients/' + f.patientId).update({caregivers: []});
  await rest(':commit', f.care, 403, {writes: [write(rx + '-revoked', fields, true)]});
});

test('new prescription creation rejects unauthorized roles, forged ownership, stale timestamps and reminder scope attacks', async () => {
  const f = await fixture();
  const secondary = 'secondary-' + f.patientId;
  await db.doc('patients/' + f.patientId).update({families: [f.owner, secondary]});
  const str = value => ({stringValue: value});
  for (const attack of ['secondary', 'outsider', 'anonymous', 'creator', 'timestamp', 'patient', 'recipients']) {
    const id = 'attack-' + attack + '-' + f.patientId;
    const uid = attack === 'secondary' ? secondary : attack === 'outsider' ? f.outsider : attack === 'anonymous' ? null : f.care;
    const fields = {patientId: str(f.patientId), createdBy: str(attack === 'creator' ? f.owner : uid || f.care), title: str('Synthetic')};
    if (attack === 'timestamp') fields.createdAt = {timestampValue: '2020-01-01T00:00:00Z'};
    const writes = [{update: {name: `projects/${project}/databases/(default)/documents/prescriptions/${id}`, fields},
      ...(attack === 'timestamp' ? {} : {updateTransforms: [{fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME'}]})}];
    if (['patient', 'recipients'].includes(attack)) {
      writes.push({update: {name: `projects/${project}/databases/(default)/documents/medication_reminders/${id}`, fields: {
        patientId: str(attack === 'patient' ? 'other-patient' : f.patientId), prescriptionId: str(id),
        notifyUserIds: {arrayValue: {values: [f.owner, secondary, f.care, ...(attack === 'recipients' ? [f.outsider] : [])].map(str)}},
      }}, updateTransforms: [{fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME'}]});
    }
    await rest(':commit', uid, 403, {writes});
    assert.equal((await db.doc('prescriptions/' + id).get()).exists, false, attack + ' must roll back the entire batch');
  }
});

test('regeneration and revocation cancel pending requests and prevent reuse', async () => {
  const f = await fixture();
  await f.service.joinCareTarget(req(f.outsider, {code: f.inviteCode}));
  const manage = data => f.service.manageInvitation(req(f.owner, {patientId: f.patientId, ...data}));
  const first = await manage({action: 'get'});
  const requests = await db.collection('users/profile-' + f.outsider + '/join_requests').get();
  await rest('/' + requests.docs[0].ref.path, f.outsider, 200, null, 'GET');
  await rest('/' + requests.docs[0].ref.path, f.care, 403, null, 'GET');
  await patchDoc(requests.docs[0].ref.path, f.outsider, {status: 'approved'}, 403);
  await manage({action: 'regenerate'});
  assert.equal((await requests.docs[0].ref.get()).data().status, 'revoked');
  await assert.rejects(manage({action: 'approve', requestId: first.requestId}), {code: 'failed-precondition'});
  await assert.rejects(f.service.joinCareTarget(req(f.outsider, {code: f.inviteCode})), {code: 'not-found'});
  const second = await manage({action: 'get'});
  assert.notEqual(second.code, f.inviteCode);
  await f.service.joinCareTarget(req(f.outsider, {code: second.code}));
  await manage({action: 'revoke'});
  await assert.rejects(f.service.joinCareTarget(req(f.outsider, {code: second.code})), {code: 'not-found'});
  await rest('/patients/' + f.patientId, f.outsider, 403, null, 'GET');
});

test('approval rejects stale request, changed role, and pending deletion', async () => {
  const f = await fixture();
  await f.service.joinCareTarget(req(f.outsider, {code: f.inviteCode}));
  const pending = await f.service.manageInvitation(req(f.owner, {patientId: f.patientId, action: 'get'}));
  const approve = requestId => f.service.manageInvitation(req(f.owner, {patientId: f.patientId, action: 'approve', requestId}));
  await assert.rejects(approve('wrong'), {code: 'failed-precondition'});
  await db.doc('users/profile-' + f.outsider).update({role: 'family'});
  await assert.rejects(approve(pending.requestId), {code: 'failed-precondition'});
  await db.doc('users/profile-' + f.outsider).update({role: 'caregiver'});
  await db.doc('_account_deletions/' + f.outsider).set({pending: true});
  await assert.rejects(approve(pending.requestId), {code: 'permission-denied'});
  await rest('/patients/' + f.patientId, f.outsider, 403, null, 'GET');
});

test('regenerated code expires exactly after 24 hours; rejection never grants access', async () => {
  const f = await fixture();
  const manage = data => f.service.manageInvitation(req(f.owner, {patientId: f.patientId, ...data}));
  await manage({action: 'regenerate'});
  const fresh = await manage({action: 'get'});
  f.advance(86400000);
  await assert.rejects(f.service.joinCareTarget(req(f.outsider, {code: fresh.code})), {code: 'not-found'});
  await manage({action: 'regenerate'});
  const next = await manage({action: 'get'});
  await f.service.joinCareTarget(req(f.outsider, {code: next.code}));
  const pending = await manage({action: 'get'});
  await manage({action: 'reject', requestId: pending.requestId});
  assert.equal((await f.service.joinCareTarget(req(f.outsider, {code: next.code}))).status, 'rejected');
  await rest('/patients/' + f.patientId, f.outsider, 403, null, 'GET');
});

test('anonymous and unrelated users cannot get patient or health records', async () => {
  const f = await fixture();
  for (const uid of [null, f.outsider]) {
    await rest('/patients/' + f.patientId, uid, 403, null, 'GET');
    await rest('/health_records/' + f.recordId, uid, 403, null, 'GET');
  }
});
test('family and caregiver may read only linked patient records', async () => {
  const f = await fixture();
  for (const uid of [f.owner, f.care]) {
    await rest('/patients/' + f.patientId, uid, 200, null, 'GET');
    await rest('/health_records/' + f.recordId, uid, 200, null, 'GET');
  }
});
test('blanket collection queries and invite lookup are denied', async () => {
  const f = await fixture();
  for (const collection of ['patients', 'health_records']) {
    await rest(':runQuery', f.owner, 403, query(collection));
  }
  await rest(':runQuery', f.outsider, 403, query('patients', 'inviteCode', 'EQUAL', f.inviteCode));
});
test('existing array-contains patient lists still work', async () => {
  const f = await fixture();
  for (const [uid, field] of [[f.owner, 'families'], [f.care, 'caregivers']]) {
    const result = await rest(':runQuery', uid, 200, query('patients', field, 'ARRAY_CONTAINS', uid));
    assert.ok(result.some(row => row.document?.name.endsWith('/' + f.patientId)));
  }
});
test('health chart filtered query works, unrelated patient filter denied', async () => {
  const f = await fixture();
  const body = query('health_records', 'patientId', 'EQUAL', f.patientId);
  body.structuredQuery.orderBy = [{field: {fieldPath: 'createdAt'}, direction: 'DESCENDING'}];
  body.structuredQuery.limit = 300;
  await rest(':runQuery', f.owner, 200, body);
  await rest(':runQuery', f.care, 200, body);
  await rest(':runQuery', f.outsider, 403, body);
});
test('direct self-join or owner-granted membership is denied', async () => {
  const f = await fixture();
  await patchDoc('patients/' + f.patientId, f.outsider, {caregivers: [f.care, f.outsider]}, 403);
  await patchDoc('patients/' + f.patientId, f.owner, {families: [f.owner, f.outsider]}, 403);
  await patchDoc('patients/' + f.patientId, f.owner, {patientsId: 'FORGED'}, 403);
  await patchDoc('patients/' + f.patientId, f.owner, {emergencyPhone1: '123'}, 200);
});
test('health writer cannot change patient or author; current writer can edit reading', async () => {
  const f = await fixture();
  await patchDoc('health_records/' + f.recordId, f.care, {patientId: 'other'}, 403);
  await patchDoc('health_records/' + f.recordId, f.care, {caregiverId: f.outsider}, 403);
  await patchDoc('health_records/' + f.recordId, f.care, {temperature: 36.8}, 200);
});
test('removed member loses access and cannot update former health record', async () => {
  const f = await fixture();
  await db.doc('patients/' + f.patientId).update({caregivers: []});
  await rest('/patients/' + f.patientId, f.care, 403, null, 'GET');
  await rest('/health_records/' + f.recordId, f.care, 403, null, 'GET');
  await patchDoc('health_records/' + f.recordId, f.care, {temperature: 36.8}, 403);
});
test('pending-deletion account denied by Rules and both handlers', async () => {
  const f = await fixture();
  await db.doc('_account_deletions/' + f.owner).set({pending: true});
  await rest('/patients/' + f.patientId, f.owner, 403, null, 'GET');
  await rest('/health_records/' + f.recordId, f.owner, 403, null, 'GET');
  await assert.rejects(f.service.joinCareTarget(req(f.owner, {code: f.inviteCode})), {code: 'permission-denied'});
  await assert.rejects(f.service.createCareTarget(req(f.owner, {name: 'Test', notes: ''})), {code: 'permission-denied'});
});
test('join validates code server-side, adds correct role, then unlocks reads', async () => {
  const f = await fixture();
  await rest('/patients/' + f.patientId, f.outsider, 403, null, 'GET');
  const result = await f.service.joinCareTarget(req(f.outsider, {code: f.inviteCode.toLowerCase(),
    role: 'family', uid: f.owner, patientId: 'forged'}));
  assert.deepEqual(result, {patientId: f.patientId, alreadyJoined: false, status: 'pending'});
  await rest('/patients/' + f.patientId, f.outsider, 403, null, 'GET');
  const pending = await f.service.manageInvitation(req(f.owner, {patientId: f.patientId, action: 'get'}));
  await f.service.manageInvitation(req(f.owner, {patientId: f.patientId, action: 'approve', requestId: pending.requestId}));
  const data = (await db.doc('patients/' + f.patientId).get()).data();
  assert.deepEqual(data.families, [f.owner]);
  assert.deepEqual(data.caregivers, [f.care, f.outsider]);
  assert.equal(data.createdAt.toMillis(), f.patient.createdAt.toMillis());
  await rest('/patients/' + f.patientId, f.outsider, 200, null, 'GET');
  await rest('/health_records/' + f.recordId, f.outsider, 200, null, 'GET');
  assert.deepEqual(await f.service.joinCareTarget(req(f.outsider, {code: f.inviteCode})),
    {patientId: f.patientId, alreadyJoined: true, status: 'approved'});
});
test('family invitation uses trusted profile, not caller role', async () => {
  const f = await fixture();
  await db.doc('users/profile-' + f.outsider).update({role: 'family'});
  await f.service.joinCareTarget(req(f.outsider, {code: f.inviteCode, role: 'caregiver'}));
  const pending = await f.service.manageInvitation(req(f.owner, {patientId: f.patientId, action: 'get'}));
  await f.service.manageInvitation(req(f.owner, {patientId: f.patientId, action: 'approve', requestId: pending.requestId}));
  assert.deepEqual((await db.doc('patients/' + f.patientId).get()).data().families, [f.owner, f.outsider]);
});
test('expired or duplicate invite gives no patient data or membership', async () => {
  const f = await fixture();
  f.advance(86400000);
  await assert.rejects(f.service.joinCareTarget(req(f.outsider, {code: f.inviteCode})), {code: 'not-found'});
  const second = await fixture();
  await db.doc('patients/duplicate-' + second.patientId).set(second.patient);
  await assert.rejects(second.service.joinCareTarget(req(second.outsider, {code: second.inviteCode})), {code: 'not-found'});
  await rest('/patients/' + second.patientId, second.outsider, 403, null, 'GET');
});
test('unauthenticated, missing and duplicate user profiles fail closed', async () => {
  const f = await fixture();
  await assert.rejects(f.service.joinCareTarget({data: {code: f.inviteCode}}), {code: 'unauthenticated'});
  await assert.rejects(f.service.createCareTarget({data: {name: 'Test'}}), {code: 'unauthenticated'});
  await assert.rejects(f.service.joinCareTarget(req('missing', {code: f.inviteCode})), {code: 'failed-precondition'});
  await db.doc('users/duplicate-' + f.outsider).set({uid: f.outsider, role: 'family'});
  await assert.rejects(f.service.joinCareTarget(req(f.outsider, {code: f.inviteCode})), {code: 'failed-precondition'});
});
test('failed invite guesses count towards quota and cannot reset it via Rules', async () => {
  const f = await fixture();
  for (let i = 0; i < 10; i++) {
    await assert.rejects(f.service.joinCareTarget(req(f.outsider, {code: '!!!!'})), {code: 'invalid-argument'});
  }
  await assert.rejects(f.service.joinCareTarget(req(f.outsider, {code: f.inviteCode})), {code: 'resource-exhausted'});
  await patchDoc('users/profile-' + f.outsider + '/_care_target_limits/join', f.outsider, {count: 0}, 403);
  f.advance(600001);
  assert.equal((await f.service.joinCareTarget(req(f.outsider, {code: f.inviteCode}))).alreadyJoined, false);
});
test('server creation preserves schema and rejects role and ownership spoofing', async () => {
  const f = await fixture();
  const input = {name: ' New elder ', notes: ' Note ', createdBy: f.outsider,
    families: [f.outsider], inviteCode: 'FORGED', createdAt: 123};
  await assert.rejects(f.service.createCareTarget(req(f.care, input)), {code: 'permission-denied'});
  const result = await f.service.createCareTarget(req(f.owner, input));
  assert.match(result.patientId, /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_pat_[A-Z2-9]{4}$/);
  assert.match(result.inviteCode, /^[A-Z2-9]{6}$/);
  const data = (await db.doc('patients/' + result.patientId).get()).data();
  assert.equal(data.name, 'New elder');
  assert.equal(data.notes, 'Note');
  assert.equal(data.createdBy, f.owner);
  assert.deepEqual(data.families, [f.owner]);
  assert.deepEqual(data.caregivers, []);
  assert.ok(data.createdAt instanceof Timestamp);
  assert.match(data.patientsId, /^[A-Z2-9]{8}$/);
  await rest('/patients/' + result.patientId, f.owner, 200, null, 'GET');
  await rest('/patients/' + result.patientId, f.outsider, 403, null, 'GET');
});
test('server creation validates bounds and limits attempts', async () => {
  const f = await fixture();
  for (const input of [{name: ''}, {name: 123}, {name: 'x'.repeat(201)},
    {name: 'Test', notes: 'x'.repeat(5001)}]) {
    await assert.rejects(f.service.createCareTarget(req(f.owner, input)), {code: 'invalid-argument'});
  }
  for (let i = 0; i < 6; i++) {
    await assert.rejects(f.service.createCareTarget(req(f.owner, {name: ''})), {code: 'invalid-argument'});
  }
  await assert.rejects(f.service.createCareTarget(req(f.owner, {name: 'Test'})), {code: 'resource-exhausted'});
});
test('two concurrent joins consume one invitation without granting membership', async () => {
  const f = await fixture();
  const secondUid = f.outsider + '-second';
  await db.doc('users/profile-' + secondUid).set({uid: secondUid, role: 'caregiver'});
  const results = await Promise.allSettled([f.outsider, secondUid].map(uid =>
    f.service.joinCareTarget(req(uid, {code: f.inviteCode}))));
  const members = (await db.doc('patients/' + f.patientId).get()).data().caregivers;
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.ok(!members.includes(f.outsider) && !members.includes(secondUid));
});
test('private server bookkeeping is not readable or writable by clients', async () => {
  const f = await fixture();
  for (const collection of ['_care_target_locks']) {
    await rest(':runQuery', f.owner, 403, query(collection));
    await patchDoc(collection + '/forged', f.owner, {count: 0}, 403);
  }
  const limitPath = 'users/profile-' + f.owner + '/_care_target_limits/create';
  await db.doc(limitPath).set({start: Date.now(), count: 1});
  await rest('/' + limitPath, f.owner, 403, null, 'GET');
  await patchDoc(limitPath, f.owner, {count: 0}, 403);
});
test('App no longer queries unlinked patients or directly appends membership', () => {
  for (const name of ['create', 'join']) {
    const source = fs.readFileSync(path.join(__dirname, '../app/care-target/' + name + '.tsx'), 'utf8');
    assert.ok(source.includes(name + 'CareTarget('));
    assert.ok(!source.includes('collection(db, "patients")'));
    assert.ok(!source.includes('arrayUnion'));
  }
});

test('changed profiles reject field pollution, invalid types and oversized strings', async () => {
  const f = await fixture();
  for (const data of [{name: 123}, {name: 'x'.repeat(201)}, {notes: 'x'.repeat(5001)},
    {emergencyPhone1: 'x'.repeat(65)}, {isAdmin: 'true'}]) {
    await patchDoc('patients/' + f.patientId, f.owner, data, 403);
  }
  await rest('/patients/' + f.patientId + '?updateMask.fieldPaths=name', f.owner, 403, {fields: {}}, 'PATCH');
  for (const data of [{temperature: 'invalid'}, {temperature: 1e10},
    {bloodSugarType: 'x'.repeat(65)}, {patientId: ''}, {isAdmin: 'true'}]) {
    await patchDoc('health_records/' + f.recordId, f.care, data, 403);
  }
  await rest('/health_records/' + f.recordId + '?updateMask.fieldPaths=caregiverId',
    f.care, 403, {fields: {}}, 'PATCH');
});
test('health creation requires membership, own author, valid schema and server time', async () => {
  const f = await fixture();
  for (const [uid, author, serverTime, extra, expected] of [
    [f.care, f.care, true, {}, 200],
    [f.outsider, f.outsider, true, {}, 403],
    [f.care, f.owner, true, {}, 403],
    [f.care, f.care, false, {}, 403],
    [f.care, f.care, true, {extra: {stringValue: 'pollution'}}, 403],
  ]) {
    const fields = {patientId: {stringValue: f.patientId}, caregiverId: {stringValue: author},
      temperature: {doubleValue: 36.5}, ...extra};
    if (!serverTime) fields.createdAt = {timestampValue: '2020-01-01T00:00:00Z'};
    const write = {update: {name: 'projects/' + project + '/databases/(default)/documents/health_records/new-' +
      randomBytes(6).toString('hex'), fields}};
    if (serverTime) write.updateTransforms = [{fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME'}];
    await rest(':commit', uid, expected, {writes: [write]});
  }
});
test('orphaned health record is not exposed when its patient is gone', async () => {
  const f = await fixture();
  await db.doc('patients/' + f.patientId).delete();
  await rest('/health_records/' + f.recordId, f.care, 403, null, 'GET');
});
test('concurrent server creates produce separate unique targets', async () => {
  const f = await fixture();
  const results = await Promise.all([1, 2].map(i =>
    f.service.createCareTarget(req(f.owner, {name: 'Test ' + i, notes: ''}))));
  assert.notEqual(results[0].patientId, results[1].patientId);
  assert.notEqual(results[0].inviteCode, results[1].inviteCode);
  for (const result of results) {
    assert.equal((await db.collection('patients').where('inviteCode', '==', result.inviteCode).get()).size, 1);
  }
});
