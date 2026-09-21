/* eslint-disable require-jsdoc */
const {randomInt} = require("node:crypto");
const {FieldValue, Timestamp} = require("firebase-admin/firestore");
const {HttpsError} = require("firebase-functions/v2/https");
const {primaryUid} = require("./careRoles");

const DAY = 86400000;
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(length) {
  return Array.from({length}, () => alphabet[randomInt(alphabet.length)]).join("");
}
function text(value, max, required = false) {
  if (typeof value !== "string" || value.length > max ||
      (required && !value.trim())) {
    throw new HttpsError("invalid-argument", "Invalid input.");
  }
  return value.trim();
}
function joinDecision(data, uid, role, now) {
  if (!["family", "caregiver"].includes(role) ||
      !Array.isArray(data.families) || !Array.isArray(data.caregivers) ||
      ![...data.families, ...data.caregivers].every((member) =>
        typeof member === "string" && member.length > 0 &&
        member.length <= 128)) {
    throw new HttpsError("failed-precondition", "Invite unavailable.");
  }
  const field = role === "family" ? "families" : "caregivers";
  if (data[field].includes(uid)) return {field, alreadyJoined: true};
  // Never let an existing caregiver self-promote to family.
  if (data.families.includes(uid) || data.caregivers.includes(uid)) {
    throw new HttpsError("permission-denied", "Membership role mismatch.");
  }
  const issued = data.createdAt instanceof Timestamp ?
    data.createdAt.toMillis() : NaN;
    if (!Number.isFinite(issued) || issued > now || now >= issued + DAY) {
    throw new HttpsError("not-found", "Invite unavailable.",
        {reason: "expired"});
  }
  if (data[field].length >= 100) {
    throw new HttpsError("resource-exhausted", "Member limit reached.");
  }
  return {field, alreadyJoined: false};
}
function createCareTargetService(db, clock = () => Date.now()) {
  async function profile(tx, uid) {
    const pending = await tx.get(db.doc("_account_deletions/" + uid));
    if (pending.exists) {
      throw new HttpsError("permission-denied", "Account pending deletion.");
    }
    const users = await tx.get(db.collection("users")
        .where("uid", "==", uid).limit(2));
    if (users.size !== 1 ||
        !["family", "caregiver"].includes(users.docs[0].data().role)) {
      throw new HttpsError("failed-precondition", "Complete your profile.");
    }
    return users.docs[0];
  }
  async function authorize(request, action) {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    const uid = request.auth.uid;
    await db.runTransaction(async (tx) => {
      const user = await profile(tx, uid);
      // Lives under the profile so existing account recursive deletion removes it.
      const ref = user.ref.collection("_care_target_limits").doc(action);
      const snap = await tx.get(ref);
      const now = clock();
      const old = snap.exists ? snap.data() : {};
      const windowMs = action === "create" ? DAY : 10 * 60000;
      const active = Number.isFinite(old.start) && now < old.start + windowMs;
      const count = active ? old.count : 0;
      if (count >= (action === "manage" ? 100 : 10)) {
        throw new HttpsError("resource-exhausted", "Try again later.");
      }
      tx.set(ref, {start: active ? old.start : now, count: count + 1});
    });
    return uid;
  }
  async function joinCareTarget(request) {
    const uid = await authorize(request, "join");
    const code = text((request.data || {}).code, 8, true).toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(code)) {
      throw new HttpsError("invalid-argument", "Invalid invite code.");
    }
    return db.runTransaction(async (tx) => {
      const user = await profile(tx, uid);
      const matches = await tx.get(db.collection("patients")
          .where("inviteCode", "==", code).limit(2));
      // Fail closed on legacy duplicate codes instead of joining an arbitrary elder.
      if (matches.size !== 1) {
        throw new HttpsError("not-found", "Invite unavailable.");
      }
      const patient = matches.docs[0];
      const data = patient.data();
      if (!primaryUid(data)) {
        throw new HttpsError("failed-precondition", "Primary family required.");
      }
      const inviteRef = patient.ref.collection("_invitation").doc("current");
      const inviteSnap = await tx.get(inviteRef);
      const invite = inviteSnap.exists ? inviteSnap.data() : null;
      if (data[user.data().role === "family" ? "families" : "caregivers"]
          .includes(uid)) {
        return {patientId: patient.id, alreadyJoined: true, status: "approved"};
      }
      if (invite && invite.code === code && invite.applicantUid === uid) {
        return {patientId: patient.id, alreadyJoined: false,
          status: invite.status};
      }
        if (data.invitationVersion === 2 && (!invite ||
            invite.code !== code || invite.status !== "active")) {
          const reason = invite && invite.code === code ?
            (invite.status === "revoked" ? "revoked" : "used") : "invalid";
          throw new HttpsError("not-found", "Invite unavailable.", {reason});
      }
      const effectiveData = {...data, createdAt: invite ?
        invite.issuedAt : data.createdAt};
      const decision = joinDecision(effectiveData, uid, user.data().role, clock());
      if (!decision.alreadyJoined) {
        const requestRef = user.ref.collection("join_requests").doc();
        const pending = {status: "pending", patientId: patient.id,
          applicantUid: uid, role: user.data().role,
          createdAt: Timestamp.fromMillis(clock())};
        tx.create(requestRef, pending);
        tx.set(db.doc("_invite_codes/" + code), {reserved: true});
        tx.set(inviteRef, {...pending, code, applicantProfileId: user.id,
          requestId: requestRef.id, issuedAt: effectiveData.createdAt});
        tx.update(patient.ref, {invitationVersion: 2});
        return {patientId: patient.id, alreadyJoined: false, status: "pending"};
      }
      return {patientId: patient.id, alreadyJoined: true, status: "approved"};
    });
  }
  async function createCareTarget(request) {
    const uid = await authorize(request, "create");
    const input = request.data || {};
    const name = text(input.name, 200, true);
    const notes = text(input.notes === undefined ? "" : input.notes, 5000);
    return db.runTransaction(async (tx) => {
      const user = await profile(tx, uid);
      const data = user.data();
      if (data.role !== "family") {
        throw new HttpsError("permission-denied", "Family account required.");
      }
      // Serialize creates so concurrent requests cannot reuse an ID or invite.
      const lock = db.doc("_care_target_locks/create");
      await tx.get(lock);
      for (let attempt = 0; attempt < 10; attempt++) {
        const patientsId = randomCode(8);
        const inviteCode = randomCode(6);
        // Preserve the existing Taipei timestamp-based document ID convention.
        const time = new Date(clock() + 8 * 3600000).toISOString().slice(0, 19)
            .replace("T", "_").replace(/:/g, "-");
        const patientId = time + "_pat_" + patientsId.slice(-4);
        const ref = db.doc("patients/" + patientId);
        const existing = await tx.get(ref);
        const ids = await tx.get(db.collection("patients")
            .where("patientsId", "==", patientsId).limit(1));
        const codes = await tx.get(db.collection("patients")
            .where("inviteCode", "==", inviteCode).limit(1));
        if (existing.exists || !ids.empty || !codes.empty) continue;
        const codeRef = db.doc("_invite_codes/" + inviteCode);
        if ((await tx.get(codeRef)).exists) continue;
        tx.create(codeRef, {reserved: true});
        tx.create(ref, {
          patientsId, name, notes, inviteCode, families: [uid], caregivers: [],
          primaryFamilyUid: uid, invitationVersion: 2,
          createdBy: uid, createdAt: FieldValue.serverTimestamp(),
          emergencyPhone1: text(data.emergencyPhone1 || "", 64),
          emergencyPhone2: text(data.emergencyPhone2 || "", 64),
        });
        tx.create(ref.collection("_invitation").doc("current"), {
          code: inviteCode, status: "active",
          issuedAt: Timestamp.fromMillis(clock()),
        });
        tx.set(lock, {updatedAt: FieldValue.serverTimestamp()});
        return {patientId, inviteCode};
      }
      throw new HttpsError("aborted", "Please retry creation.");
    });
  }
  const manageInvitation = require("./invitationManagement")
      .createInvitationManager({db, profile, authorize, clock, randomCode,
        joinDecision});
  return {createCareTarget, joinCareTarget, manageInvitation};
}
module.exports = {createCareTargetService, joinDecision};
