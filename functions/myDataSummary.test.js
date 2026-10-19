const {test} = require("node:test");
const assert = require("node:assert/strict");
const {Timestamp} = require("firebase-admin/firestore");
const {activityRow, mediaCount, safeProfile,
  createMyDataSummaryService} = require("./myDataSummary");

test("profile output is allowlisted", () => {
  const profile = safeProfile({displayName: "小明", email: "a@example.com",
    role: "family", passwordHash: "secret", createdAt: Timestamp.fromMillis(0),
    privacyConsent: {accepted: true, version: "v2",
      acceptedAt: Timestamp.fromMillis(1), token: "secret"}});
  assert.equal(profile.displayName, "小明");
  assert.equal(profile.createdAt, "1970-01-01T00:00:00.000Z");
  assert.equal(JSON.stringify(profile).includes("secret"), false);
});
test("media references are counted by supported type", () => {
  assert.equal(mediaCount("prescriptions", {sourceImageUrl: "u"}), 1);
  assert.equal(mediaCount("abnormal_records", {mediaUrl: "u",
    entries: [{mediaUrl: "u"}, {}]}), 2);
});
test("activity excludes before and after values", () => {
  const row = activityRow({id: "x", data: () => ({operation: "profile_update",
    resourcePath: "users/u", changedFields: ["displayName"],
    occurredAt: Timestamp.fromMillis(0), before: "secret"})});
  assert.equal(row.resourceType, "users");
  assert.equal(JSON.stringify(row).includes("secret"), false);
});
test("anonymous and UID override are rejected before reads", async () => {
  const service = createMyDataSummaryService({db: {}});
  await assert.rejects(service({}), {code: "unauthenticated"});
  await assert.rejects(service({auth: {uid: "me"}, data: {uid: "victim"}}),
      {code: "invalid-argument"});
});
