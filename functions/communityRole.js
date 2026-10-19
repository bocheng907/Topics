const {FieldValue} = require("firebase-admin/firestore");
const {HttpsError} = require("firebase-functions/v2/https");

// Verify the sole profile, never a client-selected profile or role.
function createSyncCommunityRole(db) {
  return async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
    return db.runTransaction(async (tx) => {
      const profiles = await tx.get(db.collection("users").where("uid", "==", uid).limit(2));
      const pending = await tx.get(db.doc("_account_deletions/" + uid));
      const roleRef = db.doc("user_roles/" + uid);
      const existing = await tx.get(roleRef);
      if (profiles.size !== 1 || pending.exists) {
        throw new HttpsError("failed-precondition", "Account profile requires review.");
      }
      const profile = profiles.docs[0];
      const data = profile.data();
      if (!["family", "agency", "caregiver"].includes(data.role) ||
          data.accountStatus === "pending_deletion") {
        throw new HttpsError("permission-denied", "Account unavailable.");
      }
      if (existing.exists) {
        const mapping = existing.data();
        if (mapping.uid !== uid || mapping.role !== data.role || mapping.userDocId !== profile.id) {
          throw new HttpsError("failed-precondition", "Role mapping requires review.");
        }
      } else {
        tx.create(roleRef, {uid, role: data.role, userDocId: profile.id,
          updatedAt: FieldValue.serverTimestamp()});
      }
      return {role: data.role, userDocId: profile.id};
    });
  };
}
module.exports = {createSyncCommunityRole};
