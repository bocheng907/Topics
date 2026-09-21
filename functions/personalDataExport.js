/* eslint-disable require-jsdoc */
const {randomUUID} = require("node:crypto");
const {Buffer} = require("node:buffer");
const {FieldPath, Timestamp} = require("firebase-admin/firestore");
const {HttpsError} = require("firebase-functions/v2/https");
const {assertRecentAuthentication} = require("./accountDeletion");

const COMMON = ["patientId", "patientDocId", "patientsId", "createdAt",
  "updatedAt", "createdBy", "caregiverId", "caregiverUid", "familyId"];
const TEXT = ["title", "content", "text", "notes", "memo", "name",
  "titleOriginal", "titleZh", "notesOriginal", "notesZh"];
const ITEM = ["itemId", "entryId", "drug_name", "drug_name_zh", "dose",
  "dosage", "usage_zh", "usage", "usage_type", "usage_time", "time_of_day",
  "feeding_times", "note_zh", "note", "memo", "duration", "frequency",
  "days", "quantity", "unit", "createdAt", "updatedAt", "notesOriginal",
  "notesZh", "mediaType", "type", "isCompleted", "completedAt", "text",
  "title", "content", "order", "pinned", "enabled"];
const SPECS = [
  ["prescriptions", "createdBy", ["clinic_name", "department", "status"]],
  ["health_records", "caregiverId", ["temperature", "heartRate",
    "bloodPressureSys", "bloodPressureDia", "bloodSugar", "bloodSugarType"]],
  ["abnormal_records", "caregiverId", ["type", "hasMedia", "mediaType", "entries"]],
  ["voice_records", "familyId", []],
  ["calendar_events", "createdBy", ["personName", "eventTitle", "location",
    "description", "color", "startAt", "eventDate", "hour", "minute", "period",
    "isCompleted", "completedAt"]],
  ["care_notes", "caregiverUid", ["isPinned"]],
  ["daily_checklist_items", "createdBy", ["dailyChecklistDocId", "dateKey"]],
  ["medication_logs", "confirmedBy", ["logId", "reminderId", "reminderIds",
    "prescriptionId", "prescriptionIds", "medicineName", "medicineNames",
    "doseText", "doseTexts", "scheduleTime", "confirmedBy", "confirmedAt",
    "dateKey", "status"]],
  ["notifications", "recipientUid", ["recipientUid", "type", "category",
    "sourceCollection", "sourceId", "isRead", "body"]],
];
function translated(keys) {
  return [...new Set(keys.flatMap((key) =>
    [key, ...["zh", "en", "vi", "id"].map((lang) => key + "_" + lang)]))];
}
function safeValue(value, depth = 0) {
  if (depth > 12) throw new HttpsError("resource-exhausted", "Export too deep.");
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    // Do not ship bearer URLs, even when pasted into a text field.
    return value.replace(/https:\/\/firebasestorage\.googleapis\.com\/[^\s"'<>]+/gi,
        "[media URL omitted]");
  }
  if (Array.isArray(value)) return value.map((v) => safeValue(v, depth + 1));
  // Unknown nested objects are intentionally omitted, not blindly serialized.
  return null;
}
function select(data, keys) {
  const result = {};
  for (const key of translated(keys)) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    if (key === "entries" && Array.isArray(data[key])) {
      result[key] = data[key].map((entry) => select(entry || {}, ITEM));
    } else {
      result[key] = safeValue(data[key]);
    }
  }
  return result;
}
function linked(data, uid) {
  return [data.families, data.caregivers].some((list) =>
    Array.isArray(list) && list.includes(uid));
}
function createPersonalDataExportService({db, clock = () => Date.now(),
  maxDocuments = 5000, maxBytes = 4 * 1024 * 1024, pageSize = 200}) {
  return async function exportPersonalData(request) {
    assertRecentAuthentication(request, new Date(clock()));
    if (request.data && Object.keys(request.data).length) {
      throw new HttpsError("invalid-argument", "Export accepts no UID or filters.");
    }
    const uid = request.auth.uid;
    const profiles = await db.collection("users").where("uid", "==", uid)
        .limit(2).get();
    if (profiles.size !== 1) {
      throw new HttpsError("failed-precondition", "Unique profile required.");
    }
    const profileRef = profiles.docs[0].ref;
    const pendingRef = db.doc("_account_deletions/" + uid);
    const limitRef = profileRef.collection("_export_limits").doc("current");
    await db.runTransaction(async (tx) => {
      const [pending, profile, limit] = await Promise.all([
        tx.get(pendingRef), tx.get(profileRef), tx.get(limitRef),
      ]);
      if (pending.exists || !profile.exists || profile.data().uid !== uid) {
        throw new HttpsError("permission-denied", "Account not available.");
      }
      const now = clock();
      const old = limit.exists ? limit.data() : {};
      const active = Number.isFinite(old.start) && now < old.start + 3600000;
      const count = active ? old.count : 0;
      if (count >= 3) {
        throw new HttpsError("resource-exhausted", "Export rate limit reached.");
      }
      tx.set(limitRef, {start: active ? old.start : now, count: count + 1});
    });
    let scanned = 0;
    let bytes = 0;
    const output = {
      schemaVersion: 1,
      generatedAt: new Date(clock()).toISOString(),
      account: {uid, email: request.auth.token.email || null,
        emailVerified: request.auth.token.email_verified === true},
      profile: select(profiles.docs[0].data(), ["uid", "email", "role",
        "createdAt", "activePatientId", "emergencyPhone1", "emergencyPhone2"]),
      scope: {
        mode: "own-authored-currently-accessible",
        mediaIncluded: false,
        omitted: ["other user profiles", "other members' authored records",
          "patient profiles and membership lists", "media binaries and URLs",
          "device tokens", "credentials", "audit logs", "derived reminders",
          "unknown/unlisted fields", "local-only unsynced data"],
        consistency: "Collected over time; access rechecked before delivery.",
      },
      records: {},
      counts: {},
      skippedInaccessible: 0,
    };
    const consent = profiles.docs[0].data().privacyConsent;
    if (consent && typeof consent === "object") {
      output.profile.privacyConsent = select(consent,
          ["accepted", "version", "acceptedAt"]);
    }
    async function scan(query, consume) {
      let cursor;
      for (;;) {
        let page = query.orderBy(FieldPath.documentId()).limit(pageSize);
        if (cursor) page = page.startAfter(cursor);
        const snap = await page.get();
        for (const doc of snap.docs) {
          if (++scanned > maxDocuments) {
            throw new HttpsError("resource-exhausted", "Export too large.");
          }
          await consume(doc);
        }
        if (snap.size < pageSize) break;
        cursor = snap.docs[snap.docs.length - 1];
      }
    }
    const patientRefs = new Map();
    for (const field of ["families", "caregivers"]) {
      await scan(db.collection("patients").where(field, "array-contains", uid),
          async (doc) => {
            if (linked(doc.data(), uid)) patientRefs.set(doc.id, doc.ref);
          });
    }
    if (patientRefs.size > 100) {
      throw new HttpsError("resource-exhausted", "Too many linked patients.");
    }
    function accessible(data) {
      const id = data.patientDocId || data.patientId;
      return typeof id === "string" && patientRefs.has(id);
    }
    function add(group, doc, keys) {
      const row = {id: doc.id, data: select(doc.data(), keys)};
      bytes += Buffer.byteLength(JSON.stringify(row), "utf8");
      if (bytes > maxBytes) {
        throw new HttpsError("resource-exhausted", "Export too large.");
      }
      if (!output.records[group]) output.records[group] = [];
      output.records[group].push(row);
    }
    for (const [collection, owner, fields] of SPECS) {
      output.records[collection] = [];
      await scan(db.collection(collection).where(owner, "==", uid),
          async (doc) => {
            const data = doc.data();
            if (data[owner] !== uid ||
                (!accessible(data) && !(collection === "notifications" &&
                  !data.patientId && !data.patientDocId))) {
              output.skippedInaccessible++;
              return;
            }
            add(collection, doc, [...COMMON, ...TEXT, ...fields]);
            if (["prescriptions", "daily_checklist_items"].includes(collection)) {
              await scan(doc.ref.collection("items"), async (item) => {
                const child = item.data();
                if ((child.createdBy && child.createdBy !== uid) ||
                    (child.patientId && child.patientId !== data.patientId)) {
                  output.skippedInaccessible++;
                  return;
                }
                const before = (output.records[collection + "_items"] || []).length;
                add(collection + "_items", item, [...ITEM, "patientId"]);
                output.records[collection + "_items"][before].parentId = doc.id;
              });
            }
          });
    }
    for (const [patientId, patientRef] of patientRefs) {
      await scan(db.doc("chats/" + patientId).collection("messages")
          .where("senderId", "==", uid), async (doc) => {
        if (doc.data().senderId === uid) {
          add("messages", doc, [...TEXT, "senderId", "createdAt"]);
          output.records.messages[output.records.messages.length - 1]
              .patientId = patientId;
        }
      });
      await scan(patientRef.collection("care_notes")
          .where("createdBy", "==", uid), async (doc) => {
        if (doc.data().createdBy === uid &&
            doc.data().patientId === patientId) {
          add("patient_care_notes", doc, [...COMMON, ...TEXT, "pinned"]);
        }
      });
    }
    for (const [group, rows] of Object.entries(output.records)) {
      output.counts[group] = rows.length;
    }
    const json = JSON.stringify(output, null, 2);
    if (Buffer.byteLength(json, "utf8") > maxBytes) {
      throw new HttpsError("resource-exhausted", "Export too large.");
    }
    // Recheck access in the same transaction as the minimal generation audit.
    // No exported content, password, token or download URL is logged.
    await db.runTransaction(async (tx) => {
      const pending = await tx.get(pendingRef);
      const profile = await tx.get(profileRef);
      const patients = await Promise.all([...patientRefs.values()]
          .map((ref) => tx.get(ref)));
      if (pending.exists || !profile.exists || profile.data().uid !== uid ||
          patients.some((p) => !p.exists || !linked(p.data(), uid))) {
        throw new HttpsError("permission-denied", "Access changed; retry.");
      }
      tx.create(db.collection("audit_logs").doc(), {
        schemaVersion: 1, source: "callable", operation: "personal_data_export",
        actorId: uid, actorType: "firebase_user", createdAt: Timestamp.now(),
        occurredAt: Timestamp.now(),
        recordCount: Object.values(output.counts).reduce((sum, n) => sum + n, 0),
      });
    });
    return {filename: "personal-data-" + randomUUID() + ".json", json,
      counts: output.counts, skippedInaccessible: output.skippedInaccessible};
  };
}
module.exports = {createPersonalDataExportService, select, safeValue};
