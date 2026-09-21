/* eslint-disable require-jsdoc */
const {FieldValue, Timestamp} = require("firebase-admin/firestore");
const {HttpsError} = require("firebase-functions/v2/https");
const {primaryUid} = require("./careRoles");
function createInvitationManager({db, profile, authorize, clock, randomCode,
  joinDecision}) {
  return async (request) => {
    const uid = await authorize(request, "manage");
    const input = request.data || {};
    const patientId = input.patientId;
    if (typeof patientId !== "string" || !patientId ||
        patientId.length > 256 || patientId.includes("/") ||
        !["get", "regenerate", "revoke", "approve", "reject"]
            .includes(input.action)) {
      throw new HttpsError("invalid-argument", "Invalid operation.");
    }
    return db.runTransaction(async (tx) => {
      await profile(tx, uid);
      const patientRef = db.doc("patients/" + patientId);
      const patient = await tx.get(patientRef);
      if (!patient.exists || primaryUid(patient.data()) !== uid) {
        throw new HttpsError("permission-denied", "Primary family required.");
      }
      const ref = patientRef.collection("_invitation").doc("current");
      const snap = await tx.get(ref);
      const old = snap.exists ? snap.data() : {
        code: patient.data().inviteCode,
        status: patient.data().invitationVersion === 2 ? "revoked" : "active",
        issuedAt: patient.data().createdAt,
      };
      if (input.action === "get") {
        return {code: old.code || "", status: old.status,
          expiresAt: old.issuedAt instanceof Timestamp ?
            old.issuedAt.toMillis() + 86400000 : 0,
          requestId: old.requestId || "", role: old.role || "",
          applicantUid: old.applicantUid || ""};
      }
      const requestRef = old.requestId && old.applicantProfileId ?
        db.doc("users/" + old.applicantProfileId +
          "/join_requests/" + old.requestId) : null;
      if (["approve", "reject"].includes(input.action)) {
        if (old.status !== "pending" || !requestRef ||
            input.requestId !== old.requestId) {
          throw new HttpsError("failed-precondition", "Application changed.");
        }
        if (input.action === "approve") {
          const applicant = await profile(tx, old.applicantUid);
          if (applicant.id !== old.applicantProfileId ||
              applicant.data().role !== old.role) {
            throw new HttpsError("failed-precondition", "Applicant changed.");
          }
          const now = clock();
          const decision = joinDecision({...patient.data(),
            createdAt: Timestamp.fromMillis(now)}, old.applicantUid,
          old.role, now);
          if (!decision.alreadyJoined) {
            tx.update(patientRef, {
              [decision.field]: FieldValue.arrayUnion(old.applicantUid),
            });
          }
        }
        const status = input.action === "approve" ? "approved" : "rejected";
        tx.update(ref, {status});
        tx.update(requestRef, {status, decidedAt: Timestamp.fromMillis(clock())});
      } else {
        let code = old.code;
        if (input.action === "regenerate") {
          const lock = db.doc("_care_target_locks/create");
          await tx.get(lock);
          for (let i = 0; i < 10; i++) {
            code = randomCode(6);
            const reserved = await tx.get(db.doc("_invite_codes/" + code));
            const legacy = await tx.get(db.collection("patients")
                .where("inviteCode", "==", code).limit(1));
            if (!reserved.exists && legacy.empty) break;
            code = null;
          }
          if (!code) throw new HttpsError("aborted", "Please retry.");
          tx.create(db.doc("_invite_codes/" + code), {reserved: true});
          tx.set(lock, {updatedAt: FieldValue.serverTimestamp()});
        }
        if (requestRef && old.status === "pending") {
          tx.update(requestRef, {status: "revoked",
            decidedAt: Timestamp.fromMillis(clock())});
        }
        if (typeof old.code === "string" && /^[A-Z0-9]{4,8}$/.test(old.code)) {
          tx.set(db.doc("_invite_codes/" + old.code), {reserved: true});
        }
        if (typeof code !== "string") code = "";
        tx.set(ref, {code, status: input.action === "revoke" ? "revoked" : "active",
          issuedAt: Timestamp.fromMillis(clock())});
        tx.update(patientRef, {inviteCode: code, invitationVersion: 2});
      }
      tx.create(db.collection("audit_logs").doc(), {actorId: uid,
        operation: "invitation_" + input.action, patientId,
        createdAt: Timestamp.fromMillis(clock()), source: "callable"});
      return {ok: true};
    });
  };
}
module.exports = {createInvitationManager};
