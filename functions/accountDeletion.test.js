const test = require("node:test");
const assert = require("node:assert/strict");
const {HttpsError} = require("firebase-functions/v2/https");
const {
  DELETION_GRACE_DAYS,
  assertRecentAuthentication,
  deletionDateFrom,
  remainingPatientMembers,
  storageObjectNameFromUrl,
} = require("./accountDeletion");

test("deletion date is exactly 30 days after the request", () => {
  const now = new Date("2026-09-11T08:00:00.000Z");
  assert.equal(DELETION_GRACE_DAYS, 30);
  assert.equal(deletionDateFrom(now).toISOString(), "2026-10-11T08:00:00.000Z");
});

test("recent authentication accepts a fresh token", () => {
  const now = new Date("2026-09-11T08:05:00.000Z");
  assert.doesNotThrow(() => assertRecentAuthentication({
    auth: {uid: "user-1", token: {auth_time: 1789113780}},
  }, now));
});

test("recent authentication rejects an old token", () => {
  const now = new Date("2026-09-11T08:10:01.000Z");
  assert.throws(() => assertRecentAuthentication({
    auth: {uid: "user-1", token: {auth_time: 1789113600}},
  }, now), (error) => {
    assert.ok(error instanceof HttpsError);
    assert.equal(error.code, "failed-precondition");
    return true;
  });
});

test("patient membership removal preserves other linked users", () => {
  assert.deepEqual(remainingPatientMembers({
    families: ["owner", "family-2", "family-2"],
    caregivers: ["caregiver-1", "owner"],
  }, "owner"), {
    families: ["family-2"],
    caregivers: ["caregiver-1"],
    all: ["family-2", "caregiver-1"],
  });
});

test("storage URL parsing only returns Firebase object names", () => {
  const bucket = "example.firebasestorage.app";
  assert.equal(storageObjectNameFromUrl(
    "https://firebasestorage.googleapis.com/v0/b/example.firebasestorage.app/o/" +
      "chats%2Fpatient-1%2Fimages%2Fphoto.jpg?alt=media",
    bucket,
  ), "chats/patient-1/images/photo.jpg");
  assert.equal(storageObjectNameFromUrl(
    "gs://example.firebasestorage.app/voice_messages/patient-1/a.m4a",
    bucket,
  ), "voice_messages/patient-1/a.m4a");
  assert.equal(storageObjectNameFromUrl("https://example.com/file", bucket), null);
  assert.equal(storageObjectNameFromUrl(
    "https://firebasestorage.googleapis.com/v0/b/other-bucket/o/private%2Fa.jpg",
    bucket,
  ), null);
  assert.equal(storageObjectNameFromUrl(
    "https://example.com/o/private%2Fa.jpg",
    bucket,
  ), null);
});
