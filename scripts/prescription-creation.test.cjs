/* global __dirname */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
function load(name, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpile(read(name), {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}), {
    exports, require: id => { if (!(id in mocks)) throw Error('Unexpected import: ' + id); return mocks[id]; },
  });
  return exports;
}
test('creation permission uses patient membership, not a globally selected role', () => {
  const api = load('src/care-target/permissions.ts', {'firebase/firestore': {}, '@/firebase/firebaseConfig': {}});
  const patient = {families: ['primary', 'secondary'], caregivers: ['care'], primaryFamilyUid: 'primary'};
  for (const [uid, allowed] of [['primary', true], ['care', true], ['secondary', false], ['stranger', false]]) {
    assert.equal(api.canCreatePrescriptionForPatient(patient, uid), allowed);
  }
  assert.equal(api.canCreatePrescriptionForPatient({...patient, caregivers: []}, 'care'), false);
});
test('new reminders are appended to the caller batch without query or early commit', async () => {
  const writes = [];
  const fail = () => { throw Error('Unexpected database operation during batch construction'); };
  const api = load('src/reminders/createMedicationReminders.ts', {
    'firebase/firestore': {doc: (...args) => args.slice(1).join('/'),
      getDoc: async () => ({exists: () => true, data: () => ({patientsId: 'P1', families: ['family'], caregivers: ['care']})}),
      getDocs: fail, writeBatch: fail, serverTimestamp: () => 'SERVER_TIME'},
    '@/firebase/firebaseConfig': {db: {}},
    '@/src/data/firestoreDocumentIds': {makePrescriptionItemDocumentId: i => 'item-' + i,
      makeMedicationReminderDocumentId: (p, i, t) => p + '-' + i + '-' + t},
  });
  await api.createMedicationReminders({patientId: 'patient', prescriptionId: 'rx',
    creationBatch: {set: (...args) => writes.push(args), commit: fail, update: fail},
    items: [{itemId: 'item-0', drug_name_zh: 'Synthetic', dose: '1', feeding_times: ['08:00', '18:00']}]});
  assert.equal(writes.length, 2);
  assert.equal(writes[0][1].patientId, 'patient');
  assert.deepEqual(Array.from(writes[0][1].notifyUserIds), ['family', 'care']);
  assert.equal(writes[0][1].createdAt, 'SERVER_TIME');
  const page = read('app/caregiver/result.tsx');
  assert.ok(page.includes('creationBatch: batch'));
  assert.equal((page.match(/await batch.commit\(\)/g) || []).length, 1);
  assert.doesNotMatch(page, /await setDoc\(presRef/);
});
