/* eslint-disable require-jsdoc */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {createGetChatProfiles} = require("./chatProfiles");

function fixture() {
  const people = {
    carer: [{role: "caregiver", displayName: "阿蘭", avatarUrl: "https://example.com/new.jpg", email: "private", emergencyPhone1: "private"}],
    family: [{role: "family", displayName: "家屬", avatarUrl: ""}],
    outsider: [{role: "caregiver", displayName: "外人"}],
    agency: [{role: "agency"}],
  };
  const patients = {p: {families: ["family"], caregivers: ["carer"]}};
  const pending = new Set();
  const db = {
    doc: (path) => ({path}),
    collection: () => ({where: (_key, _op, uid) => ({limit: () => ({uid})})}),
    runTransaction: (fn) => fn({get: async (ref) => {
      if (ref.uid) {
        const rows = people[ref.uid] || [];
        return {size: rows.length, docs: rows.map((row) => ({data: () => row}))};
      }
      const [kind, id] = ref.path.split("/");
      const data = kind === "patients" ? patients[id] : pending.has(id);
      return {exists: !!data, data: () => data};
    }}),
  };
  return {people, patients, pending, call: createGetChatProfiles(db)};
}
const request = (uid = "family", room = "caregiver", uids = ["carer"]) =>
  ({auth: {uid}, data: {patientId: "p", room, uids}});

test("same-room members receive current identity and no private fields", async () => {
  const f = fixture();
  const first = await f.call(request());
  assert.deepEqual(first, {profiles: {carer: {displayName: "阿蘭", avatarUrl: "https://example.com/new.jpg"}}});
  f.people.carer[0].displayName = "新名稱";
  f.people.carer[0].avatarUrl = "";
  assert.deepEqual(await f.call(request()), {profiles: {carer: {displayName: "新名稱", avatarUrl: ""}}});
});
test("unauthenticated, other group, agency and pending deletion are rejected", async () => {
  const f = fixture();
  await assert.rejects(f.call({}), {code: "unauthenticated"});
  for (const uid of ["outsider", "agency"]) await assert.rejects(f.call(request(uid)), {code: "permission-denied"});
  f.pending.add("carer");
  await assert.rejects(f.call(request("carer")), {code: "permission-denied"});
});
test("family-only room excludes caregivers and unrelated identities", async () => {
  const f = fixture();
  await assert.rejects(f.call(request("carer", "family")), {code: "permission-denied"});
  assert.deepEqual(await f.call(request("family", "family", ["carer", "outsider"])), {profiles: {}});
});
test("removed members, missing and duplicate profiles are not returned", async () => {
  const f = fixture();
  f.patients.p.caregivers = [];
  assert.deepEqual(await f.call(request()), {profiles: {}});
  f.patients.p.caregivers = ["carer"];
  f.people.carer.push({role: "caregiver"});
  assert.deepEqual(await f.call(request()), {profiles: {}});
  f.people.carer = [];
  assert.deepEqual(await f.call(request()), {profiles: {}});
});
test("invalid room, oversized requests and path injection are rejected", async () => {
  const f = fixture();
  for (const data of [
    {room: "bad"}, {patientId: "p/secret"}, {uids: ["a/b"]},
    {uids: Array(31).fill("carer")},
  ]) await assert.rejects(f.call({...request(), data: {...request().data, ...data}}), {code: "invalid-argument"});
});
