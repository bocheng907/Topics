/* eslint-disable require-jsdoc */
const {FieldValue} = require("firebase-admin/firestore");
const {HttpsError} = require("firebase-functions/v2/https");

// The caller can leave only their own caregiver membership. Shared data survives.
function createLeaveCareTarget(db) {
  return async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
    const input = request.data;
    if (!input || typeof input !== "object" || Array.isArray(input) ||
        Object.keys(input).some((key) => key !== "patientId") ||
        typeof input.patientId !== "string" ||
        !/^[^/\s]{1,128}$/.test(input.patientId)) {
      throw new HttpsError("invalid-argument", "Invalid patient.");
    }
    const patientId = input.patientId;
    return db.runTransaction(async (tx) => {
      const pending = await tx.get(db.doc("_account_deletions/" + uid));
      if (pending.exists) {
        throw new HttpsError("permission-denied", "Account pending deletion.");
      }
      const profiles = await tx.get(db.collection("users")
          .where("uid", "==", uid).limit(2));
      if (profiles.size !== 1 || profiles.docs[0].data().role !== "caregiver") {
        throw new HttpsError("permission-denied", "Caregiver account required.");
      }
      const profile = profiles.docs[0];
      const patientRef = db.doc("patients/" + patientId);
      const patient = await tx.get(patientRef);
      if (!patient.exists) {
        throw new HttpsError("permission-denied", "Membership unavailable.");
      }
      const data = patient.data();
      if (!Array.isArray(data.caregivers) || !Array.isArray(data.families) ||
          data.families.includes(uid)) {
        throw new HttpsError("permission-denied", "Membership unavailable.");
      }
      // A successful retry must not create another audit entry or delete records.
      if (!data.caregivers.includes(uid)) return {patientId, alreadyLeft: true};
      tx.update(patientRef, {caregivers: FieldValue.arrayRemove(uid)});
      if (profile.data().activePatientId === patientId) {
        tx.update(profile.ref, {activePatientId: ""});
      }
      tx.create(db.collection("audit_logs").doc(), {
        actorId: uid, patientId, operation: "caregiver_self_leave",
        source: "callable", createdAt: FieldValue.serverTimestamp(),
      });
      return {patientId, alreadyLeft: false};
    });
  };
}
module.exports = {createLeaveCareTarget};
