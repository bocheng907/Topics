/* global __dirname */
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const requireFunctions = require('node:module').createRequire(
  require('node:path').join(__dirname, '../functions/package.json'));
const {initializeApp, deleteApp} = requireFunctions('firebase-admin/app');
const {getFirestore, Timestamp} = requireFunctions('firebase-admin/firestore');
const {createPersonalDataExportService} = require('../functions/personalDataExport');
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8198') {
  throw new Error('Local demo emulator only');
}
const app = initializeApp({projectId: 'demo-invite-expiry'}, 'export-tests');
const db = getFirestore(app);
after(async () => { await db.terminate(); await deleteApp(app); });
async function fixture(options = {}) {
  const uid = 'export-' + randomUUID(), other = 'other-' + randomUUID();
  const patient = 'patient-' + randomUUID(), unlinked = 'other-patient-' + randomUUID();
  const profileRef = db.doc('users/profile-' + uid);
  await profileRef.set({uid, email: 'own@example.invalid', role: 'family',
    emergencyPhone1: '123', emergencyPhone2: '456', createdAt: Timestamp.now(),
    passwordHash: 'NEVER_EXPORT', expoPushToken: 'NEVER_EXPORT',
    privacyConsent: {accepted: true, version: 'test', acceptedAt: Timestamp.now()}});
  await db.doc('users/profile-' + other).set({uid: other, email: 'PRIVATE_OTHER'});
  await db.doc('patients/' + patient).set({families: [uid, other], caregivers: [],
    name: 'PRIVATE_PATIENT_PROFILE', inviteCode: 'SECRET_CODE'});
  await db.doc('patients/' + unlinked).set({families: [other], caregivers: []});
  const request = {auth: {uid, token: {auth_time: Math.floor(Date.now() / 1000),
    email: 'own@example.invalid', email_verified: true}}, data: {}};
  return {uid, other, patient, unlinked, profileRef, request,
    run: createPersonalDataExportService({db, pageSize: 2, ...options})};
}
test('exports own profile and consent without other profiles or credentials', async () => {
  const f = await fixture();
  const result = await f.run(f.request);
  const data = JSON.parse(result.json);
  assert.equal(data.account.uid, f.uid);
  assert.equal(data.profile.privacyConsent.accepted, true);
  assert.match(data.profile.createdAt, /^\d{4}-/);
  for (const secret of ['NEVER_EXPORT', 'PRIVATE_OTHER', 'PRIVATE_PATIENT_PROFILE', 'SECRET_CODE']) {
    assert.ok(!result.json.includes(secret));
  }
  assert.match(result.filename, /^personal-data-[0-9a-f-]+\.json$/);
});
test('paginates own authored records and excludes other or unlinked records', async () => {
  const f = await fixture();
  for (let i = 0; i < 5; i++) {
    await db.collection('health_records').add({patientId: f.patient, caregiverId: f.uid,
      createdAt: Timestamp.now(), temperature: i});
  }
  await db.collection('health_records').add({patientId: f.patient, caregiverId: f.other, temperature: 999});
  await db.collection('health_records').add({patientId: f.unlinked, caregiverId: f.uid, temperature: 888});
  const result = await f.run(f.request);
  assert.equal(result.counts.health_records, 5);
  assert.equal(result.skippedInaccessible, 1);
  assert.ok(!result.json.includes('"temperature": 999'));
  assert.ok(!result.json.includes('"temperature": 888'));
});
test('prescription items, own nested notes and messages are included without media URLs', async () => {
  const f = await fixture();
  const prescription = db.collection('prescriptions').doc();
  await prescription.set({patientId: f.patient, createdBy: f.uid, title: 'My prescription', imageUrl: 'SECRET_URL'});
  await prescription.collection('items').doc('item').set({drug_name_zh: 'Test drug', dose: '1', note_zh: 'note'});
  await prescription.collection('items').doc('other').set({createdBy: f.other, note_zh: 'PRIVATE_ITEM'});
  await db.doc('chats/' + f.patient + '/messages/mine').set({senderId: f.uid, text: 'My message', imageUrl: 'SECRET_URL'});
  await db.doc('chats/' + f.patient + '/messages/other').set({senderId: f.other, text: 'PRIVATE_CHAT'});
  await db.doc('patients/' + f.patient + '/care_notes/mine').set({createdBy: f.uid, patientId: f.patient, content: 'My note'});
  const result = await f.run(f.request), data = JSON.parse(result.json);
  assert.equal(data.records.prescriptions_items[0].data.drug_name_zh, 'Test drug');
  assert.equal(data.counts.prescriptions_items, 1);
  assert.equal(data.records.messages[0].data.text, 'My message');
  assert.equal(data.records.patient_care_notes[0].data.content, 'My note');
  for (const value of ['SECRET_URL', 'PRIVATE_ITEM', 'PRIVATE_CHAT']) assert.ok(!result.json.includes(value));
});
test('own notifications are scoped to current access or account-only records', async () => {
  const f = await fixture();
  for (const data of [{recipientUid: f.uid, title: 'Account notice'},
    {recipientUid: f.uid, patientId: f.patient, title: 'Linked notice'},
    {recipientUid: f.uid, patientId: f.unlinked, title: 'NO_ACCESS'},
    {recipientUid: f.other, title: 'OTHER_NOTIFICATION'}]) {
    await db.collection('notifications').add(data);
  }
  const result = await f.run(f.request);
  assert.equal(result.counts.notifications, 2);
  assert.ok(!result.json.includes('NO_ACCESS'));
  assert.ok(!result.json.includes('OTHER_NOTIFICATION'));
});
test('pending deletion and duplicate profiles are refused', async () => {
  const f = await fixture();
  await db.doc('_account_deletions/' + f.uid).set({pending: true});
  await assert.rejects(f.run(f.request), {code: 'permission-denied'});
  const g = await fixture();
  await db.collection('users').add({uid: g.uid});
  await assert.rejects(g.run(g.request), {code: 'failed-precondition'});
});
test('quota is bounded, persists under the profile and limits fourth attempt', async () => {
  const f = await fixture();
  for (let i = 0; i < 3; i++) await f.run(f.request);
  await assert.rejects(f.run(f.request), {code: 'resource-exhausted'});
  const stored = await f.profileRef.collection('_export_limits').doc('current').get();
  assert.equal(stored.data().count, 3);
});
test('document and byte limits reject rather than silently truncate', async () => {
  const f = await fixture({maxDocuments: 2});
  for (let i = 0; i < 3; i++) {
    await db.collection('notifications').add({recipientUid: f.uid, title: 'Notice'});
  }
  await assert.rejects(f.run(f.request), {code: 'resource-exhausted'});
  const g = await fixture({maxBytes: 100});
  await assert.rejects(g.run(g.request), {code: 'resource-exhausted'});
});
test('revoked access while gathering refuses delivery and generation audit', async () => {
  const f = await fixture();
  let calls = 0;
  const wrapper = {
    collection: db.collection.bind(db), doc: db.doc.bind(db),
    runTransaction: async fn => {
      if (++calls === 2) await db.doc('patients/' + f.patient).update({families: []});
      return db.runTransaction(fn);
    },
  };
  const run = createPersonalDataExportService({db: wrapper});
  await assert.rejects(run(f.request), {code: 'permission-denied'});
  assert.equal((await db.collection('audit_logs').where('actorId', '==', f.uid).get()).size, 0);
});
test('audit records generation only, without JSON or sensitive content', async () => {
  const f = await fixture();
  await f.run(f.request);
  const logs = await db.collection('audit_logs').where('actorId', '==', f.uid).get();
  assert.equal(logs.size, 1);
  const data = logs.docs[0].data();
  assert.equal(data.operation, 'personal_data_export');
  assert.ok(!JSON.stringify(data).includes('own@example.invalid'));
  assert.equal(data.json, undefined);
});
