/* global __dirname */
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const req = require('node:module').createRequire(require('node:path').join(__dirname, '../functions/package.json'));
const {initializeApp, deleteApp} = req('firebase-admin/app');
const {getFirestore, Timestamp} = req('firebase-admin/firestore');
const {createAgencyAccessService} = require('../functions/agencyAccess');
const clientApp = require('firebase/app');
const clientDb = require('firebase/firestore');
const {createCareTargetService} = require('../functions/careTargetAccess');
const {createAgencyReportService} = require('../functions/agencyReportAccess');
const {createAccountDeletionService} = require('../functions/accountDeletion');
const clientApps = [];
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18198' || process.env.GCLOUD_PROJECT !== 'demo-invite-expiry') {
  throw new Error('Dedicated local demo emulator only');
}
const projectId = 'demo-invite-expiry';
const app = initializeApp({projectId}, 'agency-integration');
const db = getFirestore(app);
after(async () => {await Promise.all(clientApps.map(clientApp.deleteApp)); await db.terminate(); await deleteApp(app);});
function client(uid) {
  const app = clientApp.initializeApp({projectId, apiKey: 'demo-key'}, randomUUID());
  clientApps.push(app);
  const client = clientDb.getFirestore(app);
  clientDb.connectFirestoreEmulator(client, '127.0.0.1', 18198, {mockUserToken: {sub: uid, user_id: uid, email: uid + '@example.test'}});
  return client;
}
async function fixture() {
  const id = randomUUID();
  const users = Object.fromEntries(['agency', 'otherAgency', 'caregiver', 'family', 'outsider'].map(role => [role, role + id]));
  for (const [role, uid] of Object.entries(users)) {
    await db.doc('users/' + uid).set({uid, email: uid + '@example.test',
      role: role === 'otherAgency' ? 'agency' : role === 'outsider' ? 'family' : role,
      displayName: role, avatarUrl: '', activePatientId: '', emergencyPhone1: '123', emergencyPhone2: '456', createdAt: Timestamp.now()});
  }
  const patientId = 'patient' + id;
  await db.doc('patients/' + patientId).set({families: [users.family], caregivers: [users.caregiver], primaryFamilyUid: users.family});
  return {...users, patientId};
}
const request = (uid, data = {}) => ({auth: {uid}, data});
const denied = (promise, code = 'permission-denied') => assert.rejects(promise, e => e.code === code);
test('backend: agency invite is private, role-checked, stable; binding is atomic and throttled', async () => {
  const f = await fixture();
  const service = createAgencyAccessService(db);
  await denied(service.getAgencyInvite({}), 'unauthenticated');
  await denied(service.getAgencyInvite(request(f.family)));
  const first = await service.getAgencyInvite(request(f.agency));
  assert.match(first.inviteCode, /^[A-Z0-9]{6}$/);
  assert.deepEqual(await service.getAgencyInvite(request(f.agency)), first);
  await denied(service.bindAgency(request(f.family, {code: first.inviteCode})));
  const attempts = await Promise.allSettled([1, 2].map(() => service.bindAgency(request(f.caregiver, {code: first.inviteCode}))));
  assert.equal(attempts.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal((await db.doc('agency_memberships/' + f.caregiver).get()).data().agencyUid, f.agency);
  await db.doc('_account_deletions/' + f.agency).set({pending: true});
  await denied(service.getAgencyInvite(request(f.agency)));
  const other = await fixture();
  for (let i = 0; i < 10; i++) await denied(service.bindAgency(request(other.caregiver, {code: 'BADBAD'})), 'not-found');
  await denied(service.bindAgency(request(other.caregiver, {code: 'BADBAD'})), 'resource-exhausted');
});

test('rules: caregiver creates; linked members edit; family chat excludes caregivers and outsiders', async () => {
  const f = await fixture();
  const c = client(f.caregiver), family = client(f.family), outside = client(f.outsider), agency = client(f.agency);
  const prescriptionId = randomUUID();
  const path = 'prescriptions/' + prescriptionId;
  const payload = uid => ({patientId: f.patientId, createdBy: uid, createdAt: clientDb.serverTimestamp(), memo: 'synthetic'});
  await denied(clientDb.setDoc(clientDb.doc(family, path), payload(f.family)));
  await clientDb.setDoc(clientDb.doc(c, path), payload(f.caregiver));
  for (const member of [c, family]) {
    await clientDb.updateDoc(clientDb.doc(member, path), {memo: 'edited'});
    await clientDb.setDoc(clientDb.doc(member, path + '/items/' + randomUUID()), {name: 'synthetic'});
  }
  for (const stranger of [outside, agency]) {
    await denied(clientDb.getDoc(clientDb.doc(stranger, path)));
    await denied(clientDb.updateDoc(clientDb.doc(stranger, path), {memo: 'forged'}));
  }
  await denied(clientDb.updateDoc(clientDb.doc(c, path), {patientId: 'another-patient'}));
  const message = uid => ({senderId: uid, senderName: 'Synthetic', senderAvatarUrl: '', text: 'hello', createdAt: clientDb.serverTimestamp()});
  const privatePath = 'chats/' + f.patientId + '/familyMessages/' + randomUUID();
  const sharedPath = 'chats/' + f.patientId + '/messages/' + randomUUID();
  await clientDb.setDoc(clientDb.doc(family, privatePath), message(f.family));
  await clientDb.getDoc(clientDb.doc(family, privatePath));
  await denied(clientDb.getDoc(clientDb.doc(c, privatePath)));
  await denied(clientDb.setDoc(clientDb.doc(c, privatePath + 'new'), message(f.caregiver)));
  await denied(clientDb.getDoc(clientDb.doc(outside, privatePath)));
  await clientDb.setDoc(clientDb.doc(c, sharedPath), message(f.caregiver));
  await clientDb.getDoc(clientDb.doc(family, sharedPath));
  await denied(clientDb.setDoc(clientDb.doc(c, sharedPath + 'spoof'), message(f.family)));
  await clientDb.deleteDoc(clientDb.doc(family, path));
});

test('rules: agency sees only bound limited data; own profile atomic sync; summary history retained', async () => {
  const f = await fixture();
  const service = createAgencyAccessService(db);
  const invite = await service.getAgencyInvite(request(f.agency));
  await service.bindAgency(request(f.caregiver, {code: invite.inviteCode}));
  const c = client(f.caregiver), a = client(f.agency), other = client(f.otherAgency), family = client(f.family);
  await denied(clientDb.getDoc(clientDb.doc(c, 'agency_invites/' + invite.inviteCode)));
  await denied(clientDb.setDoc(clientDb.doc(family, 'agency_memberships/' + f.family), {agencyUid: f.agency}));
  const batch = clientDb.writeBatch(c);
  batch.update(clientDb.doc(c, 'users/' + f.caregiver), {displayName: 'Updated', avatarUrl: ''});
  batch.set(clientDb.doc(c, 'caregiver_profiles/' + f.caregiver), {caregiverUid: f.caregiver, profileId: f.caregiver,
    displayName: 'Updated', avatarUrl: '', phone: '123', updatedAt: clientDb.serverTimestamp()});
  await batch.commit();
  await clientDb.getDoc(clientDb.doc(a, 'caregiver_profiles/' + f.caregiver));
  await denied(clientDb.getDoc(clientDb.doc(other, 'caregiver_profiles/' + f.caregiver)));
  await denied(clientDb.getDoc(clientDb.doc(a, 'patients/' + f.patientId)));
  await denied(clientDb.getDoc(clientDb.doc(a, 'users/' + f.caregiver)));
  await denied(clientDb.updateDoc(clientDb.doc(c, 'users/' + f.caregiver), {role: 'agency'}));
  await denied(clientDb.updateDoc(clientDb.doc(c, 'caregiver_profiles/' + f.caregiver), {displayName: 'unsynced', updatedAt: clientDb.serverTimestamp()}));
  const summaries = 'caregiver_service_summaries/' + f.caregiver + '/patients/';
  const path = summaries + f.patientId;
  await clientDb.setDoc(clientDb.doc(c, path), {caregiverUid: f.caregiver, patientId: f.patientId,
    patientName: 'Synthetic', active: true, createdAt: clientDb.serverTimestamp(), updatedAt: clientDb.serverTimestamp()});
  await clientDb.getDocs(clientDb.collection(a, summaries));
  await denied(clientDb.getDocs(clientDb.collection(other, summaries)));
  const reportService = createAgencyReportService(db);
  await denied(reportService.getAgencyReportContext(request(f.outsider, {patientId: f.patientId})));
  const created = await reportService.createAgencyReport(request(f.family, {patientId: f.patientId, caregiverUid: f.caregiver, title: 'Synthetic', description: 'Test only'}));
  const reportPath = 'agency_reports/' + created.reportId;
  assert.equal((await db.doc(reportPath).get()).data().category, 'other');
  for (const category of ['', null, 123, 'unknown']) {
    await assert.rejects(reportService.createAgencyReport(request(f.family, {
      patientId: f.patientId, caregiverUid: f.caregiver,
      title: 'Invalid category', description: 'Validation', category,
    })), {code: 'invalid-argument'});
  }
  await clientDb.getDocs(clientDb.query(clientDb.collection(a, 'agency_reports'), clientDb.where('agencyUid', '==', f.agency), clientDb.where('caregiverUid', '==', f.caregiver)));
  await denied(clientDb.getDoc(clientDb.doc(other, reportPath)));
  await clientDb.updateDoc(clientDb.doc(a, reportPath), {status: 'resolved', level: 'normal', handlingNote: 'Resolved', updatedAt: clientDb.serverTimestamp(), handledAt: clientDb.serverTimestamp(), handledBy: f.agency});
  await denied(clientDb.updateDoc(clientDb.doc(a, reportPath), {agencyUid: f.otherAgency}));
  await db.doc('patients/' + f.patientId).update({caregivers: []});
  await clientDb.updateDoc(clientDb.doc(c, path), {active: false, updatedAt: clientDb.serverTimestamp()});
  assert.equal((await db.doc(path).get()).data().active, false);
  await denied(clientDb.deleteDoc(clientDb.doc(c, path)));
  await denied(clientDb.updateDoc(clientDb.doc(c, path), {active: true, updatedAt: clientDb.serverTimestamp()}));
  await db.doc('_account_deletions/' + f.family).set({pending: true});
  await denied(reportService.createAgencyReport(request(f.family, {patientId: f.patientId, caregiverUid: f.caregiver, title: 'Blocked'})));
});

test('backend: family immediately joins once; caregiver still pending; expired/revoked invites rejected', async () => {
  const f = await fixture();
  let now = Date.now();
  const service = createCareTargetService(db, () => now);
  const created = await service.createCareTarget(request(f.family, {name: 'Synthetic'}));
  const joined = await service.joinCareTarget(request(f.outsider, {code: created.inviteCode}));
  assert.equal(joined.status, 'approved');
  assert.ok((await db.doc('patients/' + created.patientId).get()).data().families.includes(f.outsider));
  await denied(service.joinCareTarget(request(f.caregiver, {code: created.inviteCode})), 'not-found');
  const other = await service.createCareTarget(request(f.family, {name: 'Pending'}));
  assert.equal((await service.joinCareTarget(request(f.caregiver, {code: other.inviteCode}))).status, 'pending');
  const expired = await service.createCareTarget(request(f.family, {name: 'Expired'}));
  now += 86400000;
  await denied(service.joinCareTarget(request(f.outsider, {code: expired.inviteCode})), 'not-found');
  now -= 86400000;
  await db.doc('patients/' + expired.patientId + '/_invitation/current').update({status: 'revoked'});
  await denied(service.joinCareTarget(request(f.outsider, {code: expired.inviteCode})), 'not-found');
});

test('backend: agency deletion waits 30 days, detaches bindings, preserves care and service history', async () => {
  const f = await fixture();
  const access = createAgencyAccessService(db);
  const invite = await access.getAgencyInvite(request(f.agency));
  await access.bindAgency(request(f.caregiver, {code: invite.inviteCode}));
  const summary = db.doc('caregiver_service_summaries/' + f.caregiver + '/patients/' + f.patientId);
  await summary.set({caregiverUid: f.caregiver, patientId: f.patientId, active: true});
  const record = db.doc('health_records/' + randomUUID());
  await record.set({patientId: f.patientId, caregiverId: f.caregiver, temperature: 36.5});
  let now = new Date();
  const deleted = [], prefixes = [];
  const service = createAccountDeletionService({db, now: () => now,
    auth: {deleteUser: async uid => deleted.push(uid)},
    bucket: {name: 'synthetic', deleteFiles: async ({prefix}) => prefixes.push(prefix), file: () => ({delete: async () => {}})}});
  const req = {auth: {uid: f.agency, token: {auth_time: Math.floor(now.getTime() / 1000)}}, data: {}};
  await service.requestAccountDeletion(req);
  const before = new Date(now);
  now = new Date(before.getTime() + 30 * 86400000 - 1);
  await service.purgeDueAccounts();
  assert.ok((await db.doc('agency_memberships/' + f.caregiver).get()).exists);
  assert.ok(!deleted.includes(f.agency));
  now = new Date(before.getTime() + 30 * 86400000);
  await service.purgeDueAccounts();
  assert.ok(deleted.includes(f.agency));
  assert.ok(!(await db.doc('agency_memberships/' + f.caregiver).get()).exists);
  assert.ok((await summary.get()).exists);
  assert.ok((await record.get()).exists);
  assert.ok((await db.doc('patients/' + f.patientId).get()).data().caregivers.includes(f.caregiver));
  assert.equal((await db.doc('agency_invites/' + invite.inviteCode).get()).data().active, false);
  assert.ok(prefixes.includes('profile_images/' + f.agency + '/'));
  assert.ok(!prefixes.some(prefix => prefix.includes(f.patientId) || prefix.includes(f.caregiver)));
  const next = await access.getAgencyInvite(request(f.otherAgency));
  await access.bindAgency(request(f.caregiver, {code: next.inviteCode}));
  assert.equal((await db.doc('agency_memberships/' + f.caregiver).get()).data().agencyUid, f.otherAgency);
});
