/* eslint-disable require-jsdoc */
const {Timestamp} = require("firebase-admin/firestore");
const {HttpsError} = require("firebase-functions/v2/https");

function mediaCount(collectionName, data) {
  if (collectionName === "prescriptions") return data.sourceImageUrl ? 1 : 0;
  if (collectionName === "voice_records") return data.audioUrl ? 1 : 0;
  if (collectionName === "messages") return data.imageUrl ? 1 : 0;
  if (collectionName === "abnormal_records") {
    return (data.mediaUrl ? 1 : 0) + (Array.isArray(data.entries) ?
      data.entries.filter((entry) => entry && entry.mediaUrl).length : 0);
  }
  return 0;
}

function iso(value) {
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  return value instanceof Date ? value.toISOString() : null;
}

function safeProfile(data) {
  const consent = data.privacyConsent && typeof data.privacyConsent === "object" ?
    data.privacyConsent : {};
  const text = (value, maximum) => typeof value === "string" ?
    value.slice(0, maximum) : "";
  return {
    displayName: text(data.displayName, 120),
    email: text(data.email, 320),
    role: ["family", "caregiver", "agency"].includes(data.role) ? data.role : "unknown",
    emergencyPhone1: text(data.emergencyPhone1, 64),
    emergencyPhone2: text(data.emergencyPhone2, 64),
    createdAt: iso(data.createdAt),
    privacyConsent: {accepted: consent.accepted === true,
      version: text(consent.version, 64), acceptedAt: iso(consent.acceptedAt)},
  };
}

function activityRow(doc) {
  const data = doc.data();
  const resourcePath = typeof data.resourcePath === "string" ?
    data.resourcePath.slice(0, 500) : "";
  return {id: doc.id,
    operation: typeof data.operation === "string" ?
      data.operation.slice(0, 120) : "unknown",
    occurredAt: iso(data.occurredAt || data.createdAt),
    resourceType: resourcePath ? resourcePath.split("/")[0] : null,
    changedFields: Array.isArray(data.changedFields) ? data.changedFields
        .filter((value) => typeof value === "string").slice(0, 20) : []};
}

function linked(data, uid) {
  return [data.families, data.caregivers].some((list) =>
    Array.isArray(list) && list.includes(uid));
}

function createMyDataSummaryService({db, clock = () => Date.now(),
  maximum = 5000}) {
  return async function myDataSummary(request) {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");
    if (request.data && Object.keys(request.data).length) {
      throw new HttpsError("invalid-argument", "Summary accepts no filters.");
    }
    const uid = request.auth.uid;
    const profiles = await db.collection("users").where("uid", "==", uid)
        .limit(2).get();
    if (profiles.size !== 1) {
      throw new HttpsError("failed-precondition", "Unique profile required.");
    }
    if ((await db.doc("_account_deletions/" + uid).get()).exists) {
      throw new HttpsError("permission-denied", "Account pending deletion.");
    }
    const patients = new Map();
    for (const field of ["families", "caregivers"]) {
      const snap = await db.collection("patients").where(field, "array-contains", uid)
          .limit(maximum + 1).get();
      for (const doc of snap.docs.slice(0, maximum)) {
        if (linked(doc.data(), uid)) patients.set(doc.id, doc);
      }
    }
    const counts = {careTargets: patients.size, messages: 0};
    const media = {prescriptionImages: 0, abnormalMedia: 0,
      voiceRecordings: 0, chatImages: 0, total: 0};
    const truncatedCollections = [];
    const specs = [["prescriptions", "createdBy"],
      ["health_records", "caregiverId"], ["abnormal_records", "caregiverId"],
      ["voice_records", "familyId"], ["calendar_events", "createdBy"],
      ["care_notes", "caregiverUid"], ["daily_checklist_items", "createdBy"],
      ["medication_logs", "confirmedBy"], ["notifications", "recipientUid"]];
    for (const [name, owner] of specs) {
      const snap = await db.collection(name).where(owner, "==", uid)
          .limit(maximum + 1).get();
      if (snap.size > maximum) truncatedCollections.push(name);
      counts[name] = 0;
      for (const doc of snap.docs.slice(0, maximum)) {
        const data = doc.data();
        // Care notes store a business/display ID in patientId, not the document
        // ID. An explicit patientDocId is authoritative: never fall back to a
        // different, linked patient when it points to an inaccessible document.
        const patientId = name === "care_notes" ?
          (data.patientDocId ?? data.patientId) :
          (data.patientId || data.patientDocId);
        if (data[owner] !== uid || (!patients.has(patientId) &&
            !(name === "notifications" && !patientId))) continue;
        counts[name]++;
        const value = mediaCount(name, data);
        if (name === "prescriptions") media.prescriptionImages += value;
        if (name === "abnormal_records") media.abnormalMedia += value;
        if (name === "voice_records") media.voiceRecordings += value;
      }
    }
    const messages = await db.collectionGroup("messages")
        .where("senderId", "==", uid).limit(maximum + 1).get();
    if (messages.size > maximum) truncatedCollections.push("messages");
    for (const doc of messages.docs.slice(0, maximum)) {
      const patientId = doc.ref.parent.parent && doc.ref.parent.parent.id;
      if (doc.data().senderId !== uid || !patients.has(patientId)) continue;
      counts.messages++;
      media.chatImages += mediaCount("messages", doc.data());
    }
    media.total = media.prescriptionImages + media.abnormalMedia +
      media.voiceRecordings + media.chatImages;
    const cutoff = Timestamp.fromMillis(clock() - 30 * 86400000);
    const logs = await db.collection("audit_logs").where("actorId", "==", uid)
        .where("occurredAt", ">=", cutoff).orderBy("occurredAt", "desc")
        .limit(30).get();
    await db.collection("audit_logs").add({schemaVersion: 1, source: "callable",
      operation: "personal_data_summary_viewed", actorId: uid,
      actorType: "firebase_user", occurredAt: Timestamp.now(),
      createdAt: Timestamp.now()});
    return {schemaVersion: 1, generatedAt: new Date(clock()).toISOString(),
      scope: "own-authored-currently-accessible",
      profile: safeProfile(profiles.docs[0].data()), counts, media,
      recentActivity: logs.docs.map(activityRow),
      complete: truncatedCollections.length === 0, truncatedCollections};
  };
}

module.exports = {activityRow, mediaCount, safeProfile,
  createMyDataSummaryService};
