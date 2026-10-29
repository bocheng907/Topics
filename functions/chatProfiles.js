/* eslint-disable require-jsdoc */
const {HttpsError} = require("firebase-functions/v2/https");

// Return only room-visible identity, never private account/contact fields.
function createGetChatProfiles(db) {
  return async function getChatProfiles(request) {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");
    const {patientId, room, uids} = request.data || {};
    if (typeof patientId !== "string" || !patientId ||
        patientId.length > 200 || patientId.includes("/") ||
        !["caregiver", "family"].includes(room) ||
        !Array.isArray(uids) || uids.length > 30 ||
        uids.some((uid) => typeof uid !== "string" || !uid ||
          uid.length > 128 || uid.includes("/"))) {
      throw new HttpsError("invalid-argument", "Invalid room request.");
    }
    return db.runTransaction(async (tx) => {
      const actor = await tx.get(db.collection("users")
          .where("uid", "==", request.auth.uid).limit(2));
      const pending = await tx.get(db.doc("_account_deletions/" + request.auth.uid));
      const patient = await tx.get(db.doc("patients/" + patientId));
      if (actor.size !== 1 || pending.exists || !patient.exists ||
          actor.docs[0].data().accountStatus === "pending_deletion") {
        throw new HttpsError("permission-denied", "Room unavailable.");
      }
      const data = patient.data();
      const families = Array.isArray(data.families) ? data.families : [];
      const caregivers = Array.isArray(data.caregivers) ? data.caregivers : [];
      const role = actor.docs[0].data().role;
      const allowed = role === "family" && families.includes(request.auth.uid) ||
        room === "caregiver" && role === "caregiver" &&
        caregivers.includes(request.auth.uid);
      if (!allowed) throw new HttpsError("permission-denied", "Room unavailable.");
      const members = new Set(room === "family" ? families : [...families, ...caregivers]);
      const profiles = {};
      for (const uid of new Set(uids)) {
        if (!members.has(uid)) continue;
        const records = await tx.get(db.collection("users")
            .where("uid", "==", uid).limit(2));
        if (records.size !== 1) continue;
        const profile = records.docs[0].data();
        if (profile.accountStatus === "pending_deletion") continue;
        profiles[uid] = {
          displayName: typeof profile.displayName === "string" ?
            profile.displayName.trim().slice(0, 120) : "",
          avatarUrl: typeof profile.avatarUrl === "string" ?
            profile.avatarUrl.trim().slice(0, 4096) : "",
        };
      }
      return {profiles};
    });
  };
}
module.exports = {createGetChatProfiles};
