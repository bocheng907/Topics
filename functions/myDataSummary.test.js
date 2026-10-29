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

function summaryFixture({pending = false} = {}) {
  const records = {
    users: [{uid: "me", displayName: "展示家屬", role: "family"}],
    patients: [{id: "linked", families: ["me"]},
      {id: "other", families: ["someone-else"]}],
    prescriptions: [
      {createdBy: "me", patientId: "linked", sourceImageUrl: "private-url"},
      {createdBy: "other", patientId: "linked"},
      {createdBy: "me", patientId: "other"},
    ],
    health_records: [{caregiverId: "other", patientId: "linked"}],
    notifications: [{recipientUid: "me"}, {recipientUid: "other"}],
    messages: [{senderId: "me", parentId: "linked", imageUrl: "private-url"},
      {senderId: "other", parentId: "linked"},
      {senderId: "me", parentId: "other"}],
    audit_logs: [{actorId: "me", operation: "login", occurredAt: Timestamp.now()},
      {actorId: "other", operation: "private", occurredAt: Timestamp.now()}],
  };
  const writes = [];
  function query(name, filters = [], maximum = Infinity) {
    return {
      where: (key, op, value) => query(name, [...filters, [key, op, value]], maximum),
      limit: (value) => query(name, filters, value),
      orderBy: () => query(name, filters, maximum),
      add: async (value) => writes.push({name, value}),
      get: async () => {
        const rows = (records[name] || []).filter((row) => filters.every(
            ([key, op, value]) => op === "array-contains" ?
              (row[key] || []).includes(value) : op === ">=" ?
                row[key].toMillis() >= value.toMillis() : row[key] === value,
        )).slice(0, maximum);
        return {size: rows.length, docs: rows.map((row, index) => ({
          id: row.id || String(index), data: () => row,
          ref: {parent: {parent: {id: row.parentId}}},
        }))};
      },
    };
  }
  return {writes, records, db: {
    collection: (name) => query(name), collectionGroup: (name) => query(name),
    doc: () => ({get: async () => ({exists: pending})}),
  }};
}

test("populated summary includes only owned, still-accessible records", async () => {
  const fixture = summaryFixture();
  const result = await createMyDataSummaryService({db: fixture.db})(
      {auth: {uid: "me"}, data: {}},
  );
  assert.equal(result.counts.careTargets, 1);
  assert.equal(result.counts.prescriptions, 1);
  assert.equal(result.counts.health_records, 0);
  assert.equal(result.counts.notifications, 1);
  assert.equal(result.counts.messages, 1);
  assert.equal(result.media.total, 2);
  assert.equal(result.recentActivity.length, 1);
  assert.equal(result.recentActivity[0].operation, "login");
  assert.equal(result.complete, true);
  assert.ok(!JSON.stringify(result).includes("private-url"));
  assert.equal(fixture.writes.length, 1);
  assert.equal(fixture.writes[0].value.actorId, "me");
});

test("pending deletion cannot read summary or create an audit event", async () => {
  const fixture = summaryFixture({pending: true});
  await assert.rejects(createMyDataSummaryService({db: fixture.db})(
      {auth: {uid: "me"}, data: {}},
  ), {code: "permission-denied"});
  assert.equal(fixture.writes.length, 0);
});

test("care notes use document IDs without widening ownership or access", async () => {
  const fixture = summaryFixture();
  fixture.records.care_notes = [
    {caregiverUid: "me", patientDocId: "linked", patientId: "business-001"},
    {caregiverUid: "me", patientDocId: "linked", patientId: ""},
    {caregiverUid: "me", patientId: "linked"}, // Legacy document-ID-only row.
    {caregiverUid: "other", patientDocId: "linked", patientId: "business-001"},
    {caregiverUid: "me", patientDocId: "other", patientId: "linked"},
    {caregiverUid: "me", patientDocId: "removed", patientId: "business-001"},
    {caregiverUid: "me", patientDocId: "", patientId: "linked"},
    {caregiverUid: "me", patientId: "business-001"},
    {caregiverUid: "me"},
  ];
  const result = await createMyDataSummaryService({db: fixture.db})(
      {auth: {uid: "me"}, data: {}},
  );
  assert.equal(result.counts.care_notes, 3);
  assert.equal(result.counts.prescriptions, 1);
  assert.equal(result.media.total, 2);
  assert.equal(result.complete, true);
});

test("summary marks bounded results as incomplete", async () => {
  const fixture = summaryFixture();
  const result = await createMyDataSummaryService({db: fixture.db, maximum: 1})(
      {auth: {uid: "me"}, data: {}},
  );
  assert.equal(result.complete, false);
  assert.ok(result.truncatedCollections.includes("prescriptions"));
  assert.ok(result.truncatedCollections.includes("messages"));
});
