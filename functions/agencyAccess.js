/* eslint-disable require-jsdoc */
const {randomInt} = require("node:crypto");
const {FieldValue} = require("firebase-admin/firestore");
const {HttpsError} = require("firebase-functions/v2/https");

function createAgencyAccessService(db, clock = () => Date.now()) {
  async function profile(tx, uid, role) {
    const pending = await tx.get(db.doc("_account_deletions/" + uid));
    const users = await tx.get(db.collection("users").where("uid", "==", uid).limit(2));
    if (pending.exists || users.size !== 1 || users.docs[0].data().role !== role) {
      throw new HttpsError("permission-denied", "Active account with the required role only.");
    }
    return users.docs[0];
  }
  async function authorize(request, role, action) {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
    await db.runTransaction(async (tx) => {
      const user = await profile(tx, uid, role);
      const ref = user.ref.collection("_agency_limits").doc(action);
      const limit = await tx.get(ref);
      const data = limit.exists ? limit.data() : {};
      const now = clock();
      const active = Number.isFinite(data.start) && now < data.start + 600000;
      const count = active ? data.count : 0;
      if (count >= 10) throw new HttpsError("resource-exhausted", "Try again later.");
      tx.set(ref, {start: active ? data.start : now, count: count + 1});
    });
    return uid;
  }
  async function getAgencyInvite(request) {
    const uid = await authorize(request, "agency", "invite");
    return db.runTransaction(async (tx) => {
      const user = await profile(tx, uid, "agency");
      const stored = user.data().agencyInviteCode;
      if (typeof stored === "string" && /^[A-Z0-9]{6}$/.test(stored)) {
        const existing = await tx.get(db.doc("agency_invites/" + stored));
        if (existing.exists && existing.data().agencyUid === uid && existing.data().active === true) {
          return {inviteCode: stored};
        }
      }
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      for (let attempt = 0; attempt < 10; attempt++) {
        const code = Array.from({length: 6}, () => alphabet[randomInt(alphabet.length)]).join("");
        const ref = db.doc("agency_invites/" + code);
        if ((await tx.get(ref)).exists) continue;
        tx.create(ref, {inviteCode: code, agencyUid: uid, active: true,
          createdAt: FieldValue.serverTimestamp()});
        tx.update(user.ref, {agencyInviteCode: code});
        return {inviteCode: code};
      }
      throw new HttpsError("aborted", "Could not allocate invite.");
    });
  }
  async function bindAgency(request) {
    const uid = await authorize(request, "caregiver", "bind");
    const code = typeof request.data?.code === "string" ? request.data.code.trim().toUpperCase() : "";
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new HttpsError("invalid-argument", "Enter a six-character code.");
    return db.runTransaction(async (tx) => {
      const user = await profile(tx, uid, "caregiver");
      const ref = db.doc("agency_memberships/" + uid);
      const existing = await tx.get(ref);
      if (existing.exists) throw new HttpsError("already-exists", "Already bound to an agency.");
      const invite = await tx.get(db.doc("agency_invites/" + code));
      if (!invite.exists || invite.data().active !== true) {
        throw new HttpsError("not-found", "Invite unavailable.");
      }
      const agencyUid = invite.data().agencyUid;
      await profile(tx, agencyUid, "agency");
      const membership = {caregiverUid: uid, caregiverEmail: user.data().email,
        agencyUid, agencyInviteCode: code};
      tx.create(ref, {...membership, createdAt: FieldValue.serverTimestamp()});
      return membership;
    });
  }
  return {getAgencyInvite, bindAgency};
}
module.exports = {createAgencyAccessService};
