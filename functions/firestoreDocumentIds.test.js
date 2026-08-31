"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  makeHealthThresholdDocumentId,
  makeNotificationDocumentId,
} = require("./firestoreDocumentIds");

test("health threshold ID uses the complete patient code", () => {
  assert.equal(
    makeHealthThresholdDocumentId({
      patientDocId: "2026-04-18_02-24-09_pat_CE5S",
      patientsId: "7kdmce5s",
    }),
    "threshold_pat_7KDMCE5S",
  );
});

test("notification ID is stable for an event and recipient", () => {
  const params = {
    dateKey: "2026-08-16",
    type: "medication_done",
    sourceCollection: "medication_logs",
    sourceId: "2026-08-16_medlog_reminder-01",
    recipientUid: "firebase-user-A1B2C3D4",
  };

  const expected = [
    "2026-08-16",
    "notification",
    "medication_done",
    "medication_logs",
    "2026-08-16_medlog_reminder-01",
    "to",
    "A1B2C3D4",
  ].join("_");

  assert.equal(makeNotificationDocumentId(params), expected);
  assert.equal(makeNotificationDocumentId(params), expected);
});

test("notification ID rejects invalid date keys", () => {
  assert.throws(
    () => makeNotificationDocumentId({
      dateKey: "2026/08/16",
      type: "custom",
      sourceCollection: "tests",
      sourceId: "source-1",
      recipientUid: "recipient-1",
    }),
    /Invalid Firestore date key/,
  );
});
