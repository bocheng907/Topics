/* eslint-disable require-jsdoc */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {Timestamp} = require("firebase-admin/firestore");
const {createInvitationManager, publicIdentity} =
  require("./invitationManagement");

const users = {
  owner: {uid: "owner", role: "family", displayName: "Owner"},
  app: {uid: "app", role: "caregiver", displayName: " Ann ",
    avatarUrl: "https://x/a.png", email: "ann@example.com"},
  sec: {uid: "sec", role: "family", email: "sec@example.com"},
  gone: {uid: "gone", role: "family", displayName: "Gone",
    accountStatus: "pending_deletion"},
};
const docs = {
  "patients/p1": {families: ["owner", "sec", "gone", "ghost"], caregivers: [],
    primaryFamilyUid: "owner", inviteCode: "ABC123", invitationVersion: 2},
  "patients/p1/_invitation/current": {code: "ABC123", status: "pending",
    issuedAt: Timestamp.fromMillis(1000), requestId: "r1", role: "caregiver",
    applicantUid: "app", applicantProfileId: "U_app"},
};
function fakeDb() {
  const ref = (path) => ({path, collection: (name) => ({
    doc: (id) => ref(path + "/" + name + "/" + id)})});
  return {
    doc: ref,
    collection: (name) => ({where: (field, op, value) => ({
      limit: () => ({query: true, name, value})})}),
    runTransaction: (fn) => fn({get: async (target) => {
      if (target.query) {
        const hit = Object.values(users).filter((u) => u.uid === target.value);
        return {size: hit.length, docs: hit.map((data) => ({data: () => data}))};
      }
      const data = docs[target.path];
      return {exists: !!data, data: () => data};
    }}),
  };
}
function manager() {
  return createInvitationManager({db: fakeDb(), profile: async () => ({}),
    authorize: async (request) => request.auth.uid, clock: () => 5000,
    randomCode: () => "ZZZZZZ", joinDecision: () => ({})});
}

test("get keeps existing fields and adds public identities", async () => {
  const result = await manager()({auth: {uid: "owner"},
    data: {patientId: "p1", action: "get"}});
  assert.equal(result.code, "ABC123");
  assert.equal(result.status, "pending");
  assert.equal(result.expiresAt, 1000 + 86400000);
  assert.equal(result.requestId, "r1");
  assert.equal(result.role, "caregiver");
  assert.equal(result.applicantUid, "app");
  assert.deepEqual(result.secondaryFamilyUids, ["sec", "gone", "ghost"]);
  assert.deepEqual(result.applicant, {displayName: "Ann",
    avatarUrl: "https://x/a.png", role: "caregiver"});
  assert.deepEqual(result.secondaryFamilyProfiles, [
    {uid: "sec", displayName: "", avatarUrl: "", role: "family"},
    {uid: "gone", displayName: "", avatarUrl: "", role: ""},
    {uid: "ghost", displayName: "", avatarUrl: "", role: ""},
  ]);
  assert.ok(!JSON.stringify(result).includes("@example.com"));
});

test("non-primary caller is still rejected", async () => {
  await assert.rejects(manager()({auth: {uid: "sec"},
    data: {patientId: "p1", action: "get"}}), {code: "permission-denied"});
});

test("publicIdentity never exposes email and tolerates bad data", () => {
  assert.deepEqual(publicIdentity({email: "a@b.c", displayName: 5}),
      {displayName: "", avatarUrl: "", role: ""});
  assert.deepEqual(publicIdentity(null),
      {displayName: "", avatarUrl: "", role: ""});
});
