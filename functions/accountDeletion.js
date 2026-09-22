const {getAuth} = require("firebase-admin/auth");
const {FieldValue, Timestamp} = require("firebase-admin/firestore");
const {getStorage} = require("firebase-admin/storage");
const {HttpsError} = require("firebase-functions/v2/https");

const DELETION_GRACE_DAYS = 30;
const RECENT_AUTH_SECONDS = 5 * 60;
const DELETION_COLLECTION = "_account_deletions";

const USER_OWNED_COLLECTIONS = [
  {name: "care_notes", field: "caregiverUid", urls: []},
  {name: "daily_checklist_items", field: "createdBy", urls: []},
  {name: "prescriptions", field: "createdBy", urls: []},
  {name: "health_records", field: "caregiverId", urls: []},
  {name: "voice_records", field: "familyId", urls: ["audioUrl"]},
  {name: "abnormal_records", field: "caregiverId", urls: ["mediaUrl"]},
  {name: "calendar_events", field: "createdBy", urls: []},
  {name: "notifications", field: "recipientUid", urls: []},
  {name: "medication_logs", field: "confirmedBy", urls: []},
];

const PATIENT_SCOPED_COLLECTIONS = [
  {name: "care_notes", field: "patientDocId", urls: []},
  {name: "daily_checklist_items", field: "patientId", urls: []},
  {name: "prescriptions", field: "patientId", urls: []},
  {name: "medication_reminders", field: "patientId", urls: []},
  {name: "medication_logs", field: "patientId", urls: []},
  {name: "health_records", field: "patientId", urls: []},
  {name: "health_thresholds", field: "patientDocId", urls: []},
  {name: "voice_records", field: "patientId", urls: ["audioUrl"]},
  {name: "abnormal_records", field: "patientId", urls: ["mediaUrl"]},
  {name: "calendar_events", field: "patientId", urls: []},
  {name: "notifications", field: "patientId", urls: []},
];

function deletionDateFrom(now, graceDays = DELETION_GRACE_DAYS) {
  return new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000);
}

function assertRecentAuthentication(request, now = new Date()) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Please sign in again.");
  }
  const authTime = Number(request.auth.token.auth_time || 0);
  const ageSeconds = Math.floor(now.getTime() / 1000) - authTime;
  if (!authTime || ageSeconds < 0 || ageSeconds > RECENT_AUTH_SECONDS) {
    throw new HttpsError(
      "failed-precondition",
      "Recent authentication is required.",
    );
  }
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === "string" && item))];
}

function remainingPatientMembers(patient, uid) {
  const families = uniqueStrings(patient.families).filter((id) => id !== uid);
  const caregivers = uniqueStrings(patient.caregivers).filter((id) => id !== uid);
  return {families, caregivers, all: [...families, ...caregivers]};
}

function storageObjectNameFromUrl(value, bucketName) {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith(`gs://${bucketName}/`)) {
    return value.slice(`gs://${bucketName}/`.length);
  }
  try {
    const url = new URL(value);
    if (url.hostname !== "firebasestorage.googleapis.com") return null;
    const prefix = `/v0/b/${bucketName}/o/`;
    if (!url.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(url.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

async function deleteStorageUrls(bucket, data, fields) {
  const names = new Set(fields
    .map((field) => storageObjectNameFromUrl(data[field], bucket.name))
    .filter(Boolean));
  for (const name of names) {
    await bucket.file(name).delete({ignoreNotFound: true});
  }
}

async function deleteSourceNotifications(db, sourceCollection, sourceId) {
  if (sourceCollection === "notifications") return;
  const notifications = await db.collection("notifications")
    .where("sourceId", "==", sourceId).get();
  for (const notification of notifications.docs) {
    if (notification.data().sourceCollection === sourceCollection) {
      await db.recursiveDelete(notification.ref);
    }
  }
}

async function deletePrescriptionDependents(db, prescriptionId) {
  const byPath = new Map();
  const queries = [
    db.collection("medication_reminders")
      .where("prescriptionId", "==", prescriptionId),
    db.collection("medication_logs")
      .where("prescriptionId", "==", prescriptionId),
    db.collection("medication_logs")
      .where("prescriptionIds", "array-contains", prescriptionId),
    db.collection("notifications")
      .where("extra.prescriptionId", "==", prescriptionId),
  ];
  for (const query of queries) {
    const snap = await query.get();
    for (const document of snap.docs) byPath.set(document.ref.path, document);
  }
  for (const document of byPath.values()) {
    const collectionName = document.ref.parent.id;
    await deleteSourceNotifications(db, collectionName, document.id);
    await db.recursiveDelete(document.ref);
  }
}

async function deleteMatchingDocuments(db, bucket, spec, value) {
  const snap = await db.collection(spec.name).where(spec.field, "==", value).get();
  for (const document of snap.docs) {
    if (spec.name === "prescriptions") {
      await deletePrescriptionDependents(db, document.id);
    }
    await deleteSourceNotifications(db, spec.name, document.id);
    await deleteStorageUrls(bucket, document.data(), spec.urls);
    await db.recursiveDelete(document.ref);
  }
}

async function deleteOwnedDescendants(reference, bucket, uid) {
  const ownerFields = [
    "caregiverUid", "caregiverId", "familyId", "createdBy",
    "senderId", "recipientUid", "confirmedBy", "uid",
  ];
  const collections = await reference.listCollections();
  for (const collection of collections) {
    const documents = await collection.get();
    for (const document of documents.docs) {
      await deleteOwnedDescendants(document.ref, bucket, uid);
      const data = document.data();
      if (ownerFields.some((field) => data[field] === uid)) {
        await deleteStorageUrls(bucket, data, ["imageUrl", "audioUrl", "mediaUrl"]);
        await document.ref.delete();
      }
    }
  }
}

async function findPatientDocuments(db, uid) {
  const byPath = new Map();
  const patients = db.collection("patients");
  const queries = [
    patients.where("families", "array-contains", uid),
    patients.where("caregivers", "array-contains", uid),
    patients.where("createdBy", "==", uid),
  ];
  for (const query of queries) {
    const snap = await query.get();
    for (const document of snap.docs) byPath.set(document.ref.path, document);
  }
  return [...byPath.values()];
}

async function deletePatientData(db, bucket, patientId, patientsId) {
  for (const spec of PATIENT_SCOPED_COLLECTIONS) {
    await deleteMatchingDocuments(db, bucket, spec, patientId);
  }
  await db.recursiveDelete(db.collection("chats").doc(patientId));
  const thresholdIds = [patientId];
  if (typeof patientsId === "string" && /^[A-Za-z0-9]+$/.test(patientsId)) {
    thresholdIds.push(`threshold_pat_${patientsId}`);
  }
  for (const thresholdId of thresholdIds) {
    await db.collection("health_thresholds").doc(thresholdId).delete()
      .catch((error) => {
        if (error.code !== 5 && error.code !== "not-found") throw error;
      });
  }
  for (const prefix of [
    `chats/${patientId}/`,
    `voice_messages/${patientId}/`,
    `abnormal_media/${patientId}/`,
  ]) {
    await bucket.deleteFiles({prefix});
  }
}

async function unlinkOrDeletePatients(db, bucket, uid) {
  const documents = await findPatientDocuments(db, uid);
  for (const document of documents) {
    const patient = document.data();
    const remaining = remainingPatientMembers(patient, uid);
    if (remaining.all.length === 0) {
      await deletePatientData(db, bucket, document.id, patient.patientsId);
      await db.recursiveDelete(document.ref);
      continue;
    }
    await deleteOwnedDescendants(document.ref, bucket, uid);
    const update = {
      families: remaining.families,
      caregivers: remaining.caregivers,
      updatedAt: FieldValue.serverTimestamp(),
    };
    // Never promote another member merely because the primary account is deleted.
    if (require("./careRoles").primaryUid(patient) === uid) {
      update.primaryFamilyUid = "";
    }
    if (patient.createdBy === uid) update.createdBy = remaining.all[0];
    await document.ref.update(update);
  }
}

async function purgeAccountData({db, auth, bucket, uid}) {
  for (const spec of USER_OWNED_COLLECTIONS) {
    await deleteMatchingDocuments(db, bucket, spec, uid);
  }
  for (const room of ["messages", "familyMessages"]) {
    const messages = await db.collectionGroup(room)
      .where("senderId", "==", uid).get();
    for (const message of messages.docs) {
      await deleteStorageUrls(bucket, message.data(), ["imageUrl"]);
      await db.recursiveDelete(message.ref);
    }
  }
  await unlinkOrDeletePatients(db, bucket, uid);
  const users = await db.collection("users").where("uid", "==", uid).get();
  for (const user of users.docs) {
    const requests = await user.ref.collection("join_requests").get();
    for (const request of requests.docs) {
      const patientId = request.data().patientId;
      if (typeof patientId !== "string" || !patientId ||
          patientId.includes("/")) continue;
      const ref = db.doc("patients/" + patientId + "/_invitation/current");
      await db.runTransaction(async (tx) => {
        const invitation = await tx.get(ref);
        if (invitation.exists && invitation.data().applicantUid === uid) {
          // Keep the code consumed; remove applicant identifiers with the account.
          tx.set(ref, {code: invitation.data().code, status: "revoked",
            issuedAt: invitation.data().issuedAt});
        }
      });
    }
    await db.recursiveDelete(user.ref);
  }
  try {
    await auth.deleteUser(uid);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
  }
}

function createAccountDeletionService({
  db,
  auth,
  bucket,
  now = () => new Date(),
}) {
  async function requestAccountDeletion(request) {
    const requestedAt = now();
    assertRecentAuthentication(request, requestedAt);
    const uid = request.auth.uid;
    const scheduledFor = deletionDateFrom(requestedAt);
    const markerRef = db.collection(DELETION_COLLECTION).doc(uid);
    const usersQuery = db.collection("users").where("uid", "==", uid);
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(markerRef);
      if (existing.exists && existing.data().status === "pending_deletion") return;
      const profiles = await transaction.get(usersQuery);
      transaction.set(markerRef, {
        uid,
        status: "pending_deletion",
        requestedAt: Timestamp.fromDate(requestedAt),
        scheduledFor: Timestamp.fromDate(scheduledFor),
        attempts: 0,
      });
      for (const profile of profiles.docs) {
        transaction.update(profile.ref, {
          accountStatus: "pending_deletion",
          deletionRequestedAt: Timestamp.fromDate(requestedAt),
          deletionScheduledFor: Timestamp.fromDate(scheduledFor),
        });
      }
    });
    return {status: "pending_deletion", scheduledFor: scheduledFor.toISOString()};
  }

  async function cancelAccountDeletion(request) {
    const cancelledAt = now();
    assertRecentAuthentication(request, cancelledAt);
    const uid = request.auth.uid;
    const markerRef = db.collection(DELETION_COLLECTION).doc(uid);
    const usersQuery = db.collection("users").where("uid", "==", uid);
    await db.runTransaction(async (transaction) => {
      const marker = await transaction.get(markerRef);
      if (!marker.exists || marker.data().status !== "pending_deletion") {
        throw new HttpsError("not-found", "No pending deletion request.");
      }
      if (marker.data().scheduledFor.toMillis() <= cancelledAt.getTime()) {
        throw new HttpsError("failed-precondition", "The deletion window has closed.");
      }
      const profiles = await transaction.get(usersQuery);
      transaction.delete(markerRef);
      for (const profile of profiles.docs) {
        transaction.update(profile.ref, {
          accountStatus: "active",
          deletionRequestedAt: FieldValue.delete(),
          deletionScheduledFor: FieldValue.delete(),
        });
      }
    });
    return {status: "active"};
  }

  async function purgeDueAccounts() {
    const currentTime = now();
    const deletionAuth = auth || getAuth();
    const deletionBucket = bucket || getStorage().bucket();
    const due = await db.collection(DELETION_COLLECTION)
      .where("scheduledFor", "<=", Timestamp.fromDate(currentTime)).get();
    let deleted = 0;
    let failed = 0;
    for (const marker of due.docs) {
      if (marker.data().status !== "pending_deletion") continue;
      try {
        await purgeAccountData({
          db,
          auth: deletionAuth,
          bucket: deletionBucket,
          uid: marker.id,
        });
        await marker.ref.delete();
        deleted += 1;
      } catch (error) {
        failed += 1;
        await marker.ref.update({
          attempts: FieldValue.increment(1),
          lastAttemptAt: FieldValue.serverTimestamp(),
          lastErrorCode: String(error.code || "unknown").slice(0, 120),
        });
      }
    }
    return {deleted, failed};
  }

  return {requestAccountDeletion, cancelAccountDeletion, purgeDueAccounts};
}

module.exports = {
  DELETION_GRACE_DAYS,
  RECENT_AUTH_SECONDS,
  assertRecentAuthentication,
  createAccountDeletionService,
  deletionDateFrom,
  remainingPatientMembers,
  storageObjectNameFromUrl,
};
