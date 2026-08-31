"use strict";

function assertDateKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`Invalid Firestore date key: ${dateKey}`);
  }
}

function normalizeIdSegment(value, label) {
  const normalized = String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) {
    throw new Error(`Missing ${label} for Firestore document ID`);
  }

  return normalized;
}

function normalizePatientCode(value) {
  return String(value || "")
    .trim()
    .replace(/^pat_/i, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function getPatientDocumentCode({patientDocId, patientsId}) {
  const fullPatientsId = normalizePatientCode(patientsId);
  if (fullPatientsId) return fullPatientsId;

  const normalizedDocId = String(patientDocId || "").trim();
  const patientCodeMatch = normalizedDocId.match(
    /(?:^|_)pat_([A-Za-z0-9]+)(?:_|$)/i,
  );
  if (patientCodeMatch && patientCodeMatch[1]) {
    return normalizePatientCode(patientCodeMatch[1]);
  }

  return normalizePatientCode(normalizedDocId.slice(-4));
}

function makeHealthThresholdDocumentId(identity) {
  const patientCode = getPatientDocumentCode(identity);
  if (!patientCode) {
    throw new Error("Missing patient code for Firestore document ID");
  }
  return `threshold_pat_${patientCode}`;
}

function makeNotificationDocumentId({
  dateKey,
  type,
  sourceCollection,
  sourceId,
  recipientUid,
}) {
  assertDateKey(dateKey);
  const normalizedType = normalizeIdSegment(type, "notification type");
  const normalizedSourceCollection = normalizeIdSegment(
    sourceCollection,
    "notification source collection",
  );
  const normalizedSourceId = normalizeIdSegment(
    sourceId,
    "notification source ID",
  );
  const normalizedRecipientUid = normalizeIdSegment(
    recipientUid,
    "notification recipient UID",
  );
  const recipientSuffix = normalizedRecipientUid.slice(-8);

  return [
    dateKey,
    "notification",
    normalizedType,
    normalizedSourceCollection,
    normalizedSourceId,
    "to",
    recipientSuffix,
  ].join("_");
}

module.exports = {
  getPatientDocumentCode,
  makeHealthThresholdDocumentId,
  makeNotificationDocumentId,
};
