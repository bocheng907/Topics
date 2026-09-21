/* eslint-disable require-jsdoc */
const {createHash} = require("node:crypto");
const {isDeepStrictEqual} = require("node:util");
const {Timestamp} = require("firebase-admin/firestore");
const {HttpsError} = require("firebase-functions/v2/https");

function logId(...parts) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function buildChange(event, kind) {
  if (!event.data) return null;
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  const fields = [...new Set([...Object.keys(before || {}),
    ...Object.keys(after || {})])].filter((key) =>
    !isDeepStrictEqual(before && before[key], after && after[key])).sort();
  const relevant = kind === "members" ?
    fields.filter((key) => ["families", "caregivers"].includes(key)) : fields;
  if (!relevant.length) return null;
  const source = after || before;
  return {
    schemaVersion: 1,
    source: "firestore_auth_context",
    operation: `${kind}_${!before ? "create" : !after ? "delete" : "update"}`,
    actorId: event.authId || null,
    actorType: event.authType || "unknown",
    resourcePath: event.data.after.ref.path,
    patientId: kind === "members" ? event.params.patientId :
      source.patientId || source.patientDocId || null,
    changedFields: relevant.slice(0, 100),
    fieldsTruncated: relevant.length > 100,
    eventId: event.id,
    occurredAt: Timestamp.fromDate(new Date(event.time)),
    createdAt: Timestamp.now(),
  };
}

async function createOnce(db, id, data) {
  try {
    await db.collection("audit_logs").doc(id).create(data);
  } catch (error) {
    if (error.code !== 6 && error.code !== "already-exists") throw error;
  }
}

function createAuditService(db) {
  return {
    async recordChange(event, kind) {
      const record = buildChange(event, kind);
      if (record) await createOnce(db, logId(event.source, event.id), record);
    },
    async recordSession(request) {
      if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
      const data = request.data || {};
      if (Object.keys(data).length !== 1 ||
          !["login", "logout_requested"].includes(data.operation)) {
        throw new HttpsError("invalid-argument", "Invalid session event");
      }
      const authTime = request.auth.token.auth_time;
      if (!Number.isSafeInteger(authTime)) {
        throw new HttpsError("unauthenticated", "Missing authentication time");
      }
      // One signal of each type per authenticated session: retries are safe.
      await createOnce(db, logId("session", request.auth.uid, authTime,
          data.operation), {
        schemaVersion: 1, source: "authenticated_client_signal",
        operation: data.operation, actorId: request.auth.uid,
        actorType: "firebase_user", createdAt: Timestamp.now(),
        occurredAt: Timestamp.now(), authTime,
      });
      return {ok: true};
    },
  };
}

module.exports = {buildChange, logId, createAuditService};
