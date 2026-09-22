/* eslint-disable require-jsdoc */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {Timestamp} = require("firebase-admin/firestore");
const {safeValue, select, createPersonalDataExportService} =
  require("./personalDataExport");
test("timestamps become ISO strings without internal Firestore fields", () => {
  assert.equal(safeValue(Timestamp.fromMillis(0)), "1970-01-01T00:00:00.000Z");
  assert.equal(safeValue(new Date(0)), "1970-01-01T00:00:00.000Z");
});
test("allowlist removes credentials, URLs and other membership", () => {
  const data = select({title: "my title", title_en: "translation",
    passwordHash: "SECRET", refreshToken: "SECRET", imageUrl: "SECRET",
    families: ["OTHER"], expoPushToken: "SECRET"}, ["title"]);
  assert.deepEqual(data, {title: "my title", title_en: "translation"});
});
test("pasted Firebase media bearer URLs are redacted from text", () => {
  assert.equal(safeValue("note https://firebasestorage.googleapis.com/v0/b/a/o/b?token=secret end"),
      "note [media URL omitted] end");
});
test("nested entries export text but omit URL and unknown maps", () => {
  assert.deepEqual(select({entries: [{notesOriginal: "note",
    mediaUrl: "secret", password: "secret", createdAt: Timestamp.fromMillis(0)}]},
  ["entries"]), {entries: [{createdAt: "1970-01-01T00:00:00.000Z",
    notesOriginal: "note"}]});
  assert.equal(safeValue({refreshToken: "secret"}), null);
});
test("non-finite and nested values are JSON-safe; excessive nesting fails", () => {
  assert.deepEqual(safeValue([NaN, Infinity, true, null]), [null, null, true, null]);
  let deep = 1;
  for (let i = 0; i < 20; i++) deep = [deep];
  assert.throws(() => safeValue(deep), {code: "resource-exhausted"});
});
test("anonymous, stale and future authentication rejected before database reads", async () => {
  const service = createPersonalDataExportService({db: {}, clock: () => 1000000});
  await assert.rejects(service({}), {code: "unauthenticated"});
  for (const authTime of [0, 600, 1001]) {
    await assert.rejects(service({auth: {uid: "me", token: {auth_time: authTime}}}),
        {code: "failed-precondition"});
  }
});
test("client UID override rejected before database reads", async () => {
  const service = createPersonalDataExportService({db: {}, clock: () => 1000000});
  await assert.rejects(service({auth: {uid: "me", token: {auth_time: 1000}},
    data: {uid: "victim"}}), {code: "invalid-argument"});
});
