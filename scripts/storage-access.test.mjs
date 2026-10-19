import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {initializeApp, deleteApp} from 'firebase/app';
import {getStorage, connectStorageEmulator, ref, uploadBytes, getMetadata, deleteObject} from 'firebase/storage';
const req = createRequire(new URL('../functions/package.json', import.meta.url));
const admin = req('firebase-admin/app');
const {getFirestore} = req('firebase-admin/firestore');
const storageEmulator = process.env.FIREBASE_STORAGE_EMULATOR_HOST === '127.0.0.1:19298' ||
  process.env.STORAGE_EMULATOR_HOST === 'http://127.0.0.1:19298';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18198' ||
    !storageEmulator ||
    (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== 'demo-invite-expiry')) throw Error('Dedicated local demo emulators only');
const projectId = 'demo-invite-expiry';
const adminApp = admin.initializeApp({projectId}, 'storage-tests');
const db = getFirestore(adminApp);
const apps = [];
after(async () => {await Promise.all(apps.map(deleteApp)); await db.terminate(); await admin.deleteApp(adminApp);});
function client(uid) {
  const app = initializeApp({projectId, apiKey: 'demo-key', storageBucket: projectId + '.appspot.com'}, randomUUID());
  apps.push(app);
  const storage = getStorage(app);
  connectStorageEmulator(storage, '127.0.0.1', 19298, uid ? {mockUserToken: {sub: uid, user_id: uid}} : {});
  return storage;
}
const denied = promise => assert.rejects(promise, e => e.code === 'storage/unauthorized');

test('family chat images stay private; avatars are own or bound-agency only', async () => {
  const patient = randomUUID(), family = randomUUID(), care = randomUUID(), agency = randomUUID(), outside = randomUUID();
  await db.doc('patients/' + patient).set({families: [family], caregivers: [care]});
  await db.doc('agency_memberships/' + care).set({caregiverUid: care, agencyUid: agency});
  const f = client(family), c = client(care), a = client(agency), o = client(outside);
  const bytes = new Uint8Array([1, 2, 3]);
  const meta = uid => ({contentType: 'image/jpeg', customMetadata: {uploaderUid: uid, patientId: patient}});
  const image = `chats/${patient}/familyImages/${randomUUID()}.jpg`;
  await uploadBytes(ref(f, image), bytes, meta(family));
  await getMetadata(ref(f, image));
  for (const other of [c, a, o]) await denied(getMetadata(ref(other, image)));
  await denied(uploadBytes(ref(c, `chats/${patient}/familyImages/${randomUUID()}.jpg`), bytes, meta(care)));
  await denied(uploadBytes(ref(f, `prescriptions/${patient}/${family}/${randomUUID()}.jpg`), bytes, meta(family)));
  const avatar = `profile_images/${care}/${randomUUID()}.jpg`;
  await uploadBytes(ref(c, avatar), bytes, meta(care));
  await getMetadata(ref(c, avatar));
  await getMetadata(ref(a, avatar));
  await denied(getMetadata(ref(o, avatar)));
  await denied(uploadBytes(ref(o, avatar), bytes, meta(outside)));
  await denied(deleteObject(ref(a, avatar)));
  await deleteObject(ref(c, avatar));
});
test('Storage enforces membership, role, UUID, metadata, deletion and account state', async () => {
  const patient = randomUUID(), family = randomUUID(), care = randomUUID(), outsider = randomUUID();
  await db.doc('patients/' + patient).set({families: [family], caregivers: [care], primaryFamilyUid: family});
  const f = client(family), c = client(care), o = client(outsider), anonymous = client();
  const image = new Uint8Array([1, 2, 3]);
  const meta = (uid, type = 'image/jpeg') => ({contentType: type, customMetadata: {uploaderUid: uid, patientId: patient}});
  const path = `prescriptions/${patient}/${care}/${randomUUID()}.jpg`;
  await uploadBytes(ref(c, path), image, meta(care));
  await getMetadata(ref(f, path));
  await denied(getMetadata(ref(o, path)));
  await denied(getMetadata(ref(anonymous, path)));
  await denied(uploadBytes(ref(c, path), new Uint8Array([4, 5, 6, 7]), meta(care)));
  await denied(deleteObject(ref(f, path)));
  await denied(uploadBytes(ref(o, `chats/${patient}/images/${randomUUID()}.jpg`), image, meta(outsider)));
  await denied(uploadBytes(ref(c, `chats/${patient}/images/${randomUUID()}.jpg`), image, meta(family)));
  await denied(uploadBytes(ref(c, `chats/${patient}/images/123.jpg`), image, meta(care)));
  await denied(uploadBytes(ref(c, `chats/${patient}/images/${randomUUID()}.jpg`), image, meta(care, 'text/plain')));
  await uploadBytes(ref(f, `chats/${patient}/images/${randomUUID()}.jpg`), image, meta(family));
  await uploadBytes(ref(c, `abnormal_media/${patient}/${randomUUID()}.mp4`), image, meta(care, 'video/mp4'));
  await denied(uploadBytes(ref(f, `abnormal_media/${patient}/${randomUUID()}.jpg`), image, meta(family)));
  await uploadBytes(ref(f, `voice_messages/${patient}/${randomUUID()}.m4a`), image, meta(family, 'audio/mp4'));
  await denied(uploadBytes(ref(c, `voice_messages/${patient}/${randomUUID()}.m4a`), image, meta(care, 'audio/mp4')));
  await db.doc('_account_deletions/' + care).set({pending: true});
  await denied(getMetadata(ref(c, path)));
  await denied(deleteObject(ref(c, path)));
  await db.doc('_account_deletions/' + care).delete();
  await deleteObject(ref(c, path));
});
