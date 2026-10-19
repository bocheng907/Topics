const {test, after} = require("node:test");
const assert = require("node:assert/strict");
const {Buffer} = require("node:buffer");
const {randomUUID} = require("node:crypto");
const {initializeApp, deleteApp} = require("firebase-admin/app");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");
const {getStorage} = require("firebase-admin/storage");
const {runRetention} = require("./retention");

// This suite intentionally refuses non-local or non-demo Firebase targets.
const projectId = "demo-invite-expiry";
const storageEmulator =
  process.env.FIREBASE_STORAGE_EMULATOR_HOST === "127.0.0.1:19298" ||
  process.env.STORAGE_EMULATOR_HOST === "http://127.0.0.1:19298";
if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:18198" ||
    !storageEmulator ||
    (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== projectId)) {
  throw new Error("Use the local demo Firestore and Storage emulators only");
}

const app = initializeApp({projectId,
  storageBucket: `${projectId}.appspot.com`}, `retention-${randomUUID()}`);
const db = getFirestore(app);
const bucket = getStorage(app).bucket();
const fixture = {refs: [], files: []};

after(async () => {
  await Promise.all(fixture.files.map((path) =>
    bucket.file(path).delete({ignoreNotFound: true}).catch(() => {})));
  await Promise.all(fixture.refs.map((ref) =>
    db.recursiveDelete(ref).catch(() => {})));
  await db.terminate();
  await deleteApp(app);
});

function timestampDaysAgo(days, now) {
  return Timestamp.fromDate(new Date(now.getTime() - days * 86400000));
}

function storageUrl(path) {
  return `https://firebasestorage.googleapis.com/v0/b/${
    encodeURIComponent(bucket.name)}/o/${encodeURIComponent(path)}?alt=media`;
}

async function uploadSynthetic(path) {
  fixture.files.push(path);
  await bucket.file(path).save(Buffer.from("synthetic-retention-test"), {
    metadata: {contentType: "image/jpeg"},
  });
}

test("retention deletes expired synthetic records and media, preserves recent data", async () => {
  const now = new Date();
  const patientId = `synthetic-${randomUUID()}`;
  const ownerUid = `synthetic-owner-${randomUUID()}`;
  const ids = Object.fromEntries([
    "health", "prescription", "abnormal", "notification", "audit", "message",
  ].map((key) => [key, randomUUID()]));
  const paths = {
    oldFamilyMessage: `chats/${patientId}/familyImages/${randomUUID()}.jpg`,
    oldPrescription: `prescriptions/${patientId}/${ownerUid}/${randomUUID()}.jpg`,
    recentPrescription: `prescriptions/${patientId}/${ownerUid}/${randomUUID()}.jpg`,
    oldAbnormal: `abnormal_media/${patientId}/${randomUUID()}.jpg`,
    recentAbnormal: `abnormal_media/${patientId}/${randomUUID()}.jpg`,
    oldMessage: `chats/${patientId}/images/${randomUUID()}.jpg`,
    recentMessage: `chats/${patientId}/images/${randomUUID()}.jpg`,
  };

  const refs = {
    oldFamilyMessage: db.doc(`chats/${patientId}/familyMessages/${randomUUID()}`),
    recentFamilyMessage: db.doc(`chats/${patientId}/familyMessages/${randomUUID()}`),
    health: db.collection("health_records").doc(ids.health),
    prescription: db.collection("prescriptions").doc(ids.prescription),
    abnormal: db.collection("abnormal_records").doc(ids.abnormal),
    notification: db.collection("notifications").doc(ids.notification),
    audit: db.collection("audit_logs").doc(ids.audit),
    oldMessage: db.doc(`chats/${patientId}/messages/${ids.message}`),
    recentHealth: db.collection("health_records").doc(randomUUID()),
    recentPrescription: db.collection("prescriptions").doc(randomUUID()),
    recentAbnormal: db.collection("abnormal_records").doc(randomUUID()),
    recentNotification: db.collection("notifications").doc(randomUUID()),
    recentAudit: db.collection("audit_logs").doc(randomUUID()),
    recentMessage: db.doc(`chats/${patientId}/messages/${randomUUID()}`),
  };
  fixture.refs.push(...Object.values(refs));

  await Promise.all([
    uploadSynthetic(paths.oldPrescription),
    uploadSynthetic(paths.recentPrescription),
    uploadSynthetic(paths.oldAbnormal),
    uploadSynthetic(paths.recentAbnormal),
    uploadSynthetic(paths.oldMessage),
    uploadSynthetic(paths.oldFamilyMessage),
    uploadSynthetic(paths.recentMessage),
  ]);

  const prescriptionItem = refs.prescription.collection("items").doc("old-item");
  const reminder = db.collection("medication_reminders").doc(ids.prescription);
  fixture.refs.push(prescriptionItem, reminder);
  const old = {
    health: timestampDaysAgo(6 * 365, now),
    prescription: timestampDaysAgo(4 * 365, now),
    abnormal: timestampDaysAgo(2 * 365, now),
    notification: timestampDaysAgo(180, now),
    audit: timestampDaysAgo(2 * 365, now),
    message: timestampDaysAgo(365, now),
  };
  const recent = timestampDaysAgo(1, now);

  await Promise.all([
    refs.health.set({patientId, caregiverId: ownerUid, createdAt: old.health}),
    refs.prescription.set({patientId, createdBy: ownerUid,
      sourceImageUrl: storageUrl(paths.oldPrescription), createdAt: old.prescription}),
    prescriptionItem.set({drug_name_zh: "synthetic medicine"}),
    reminder.set({prescriptionId: ids.prescription, patientId}),
    refs.abnormal.set({patientId, mediaUrl: storageUrl(paths.oldAbnormal),
      createdAt: old.abnormal}),
    refs.notification.set({recipientUid: ownerUid, createdAt: old.notification}),
    refs.audit.set({actorId: ownerUid, operation: "synthetic_test",
      occurredAt: old.audit, createdAt: old.audit}),
    refs.oldMessage.set({senderId: ownerUid, imageUrl: storageUrl(paths.oldMessage),
      createdAt: old.message}),
    refs.oldFamilyMessage.set({senderId: ownerUid, imageUrl: storageUrl(paths.oldFamilyMessage),
      createdAt: old.message}),
    refs.recentFamilyMessage.set({senderId: ownerUid, text: "keep", createdAt: recent}),
    refs.recentHealth.set({patientId, caregiverId: ownerUid, createdAt: recent}),
    refs.recentPrescription.set({patientId, createdBy: ownerUid,
      imageUrl: storageUrl(paths.recentPrescription), createdAt: recent}),
    refs.recentAbnormal.set({patientId, mediaUrl: storageUrl(paths.recentAbnormal),
      createdAt: recent}),
    refs.recentNotification.set({recipientUid: ownerUid, createdAt: recent}),
    refs.recentAudit.set({actorId: ownerUid, occurredAt: recent, createdAt: recent}),
    refs.recentMessage.set({senderId: ownerUid,
      imageUrl: storageUrl(paths.recentMessage), createdAt: recent}),
  ]);

  const report = await runRetention({db, bucket, dryRun: false, now});

  assert.deepEqual(report, {
    dryRun: false, deleted: 7, candidates: 7, skipped: 0, failed: 0,
  });
  for (const key of ["health", "prescription", "abnormal", "notification",
    "audit", "oldMessage", "oldFamilyMessage"]) {
    assert.equal((await refs[key].get()).exists, false, `${key} should expire`);
  }
  assert.equal((await prescriptionItem.get()).exists, false,
    "prescription item subcollection should be removed");
  assert.equal((await reminder.get()).exists, false,
    "prescription reminder should be removed");
  for (const key of ["recentHealth", "recentPrescription", "recentAbnormal",
    "recentNotification", "recentAudit", "recentMessage", "recentFamilyMessage"]) {
    assert.equal((await refs[key].get()).exists, true, `${key} should be retained`);
  }
  for (const path of [paths.oldPrescription, paths.oldAbnormal, paths.oldMessage, paths.oldFamilyMessage]) {
    assert.equal((await bucket.file(path).exists())[0], false,
      `expired media ${path} should be removed`);
  }
  for (const path of [paths.recentPrescription, paths.recentAbnormal,
    paths.recentMessage]) {
    assert.equal((await bucket.file(path).exists())[0], true,
      `recent media ${path} should be retained`);
  }
  assert.equal((await db.collection("_retention_jobs").get()).size, 0,
    "successful cleanup should leave no pending jobs");
});
