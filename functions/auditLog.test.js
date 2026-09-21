/* eslint-disable require-jsdoc */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {buildChange, createAuditService} = require("./auditLog");

function event(before, after) {
  const snap = (value) => ({exists: value !== null, data: () => value,
    ref: {path: "patients/p"}});
  return {id: "event-1", source: "firestore", time: "2026-09-11T00:00:00Z",
    authType: "unknown", authId: "verified-context", params: {patientId: "p"},
    data: {before: snap(before), after: snap(after)}};
}

function fixture() {
  const records = new Map();
  const db = {collection: (name) => {
    assert.equal(name, "audit_logs");
    return {doc: (id) => ({create: async (data) => {
      if (records.has(id)) throw Object.assign(new Error("exists"), {code: 6});
      records.set(id, data);
    }})};
  }};
  return {records, service: createAuditService(db)};
}

test("server context wins over forged actor fields and excludes medical values", () => {
  const record = buildChange(event({memo: "old"},
      {memo: "sensitive", updatedBy: "forged"}), "prescription");
  assert.equal(record.actorId, "verified-context");
  assert.equal(record.operation, "prescription_update");
  assert.deepEqual(record.changedFields, ["memo", "updatedBy"]);
  assert.ok(!JSON.stringify(record).includes("sensitive"));
  assert.ok(!JSON.stringify(record).includes("forged"));
});
test("member logs ignore unrelated updates but capture membership changes", () => {
  assert.equal(buildChange(event({name: "a"}, {name: "b"}), "members"), null);
  assert.deepEqual(buildChange(event({families: ["a"]},
      {families: ["a", "b"]}), "members").changedFields, ["families"]);
});
test("create and delete retain correct operation and resource", () => {
  assert.equal(buildChange(event(null, {patientId: "p"}), "prescription")
      .operation, "prescription_create");
  assert.equal(buildChange(event({patientId: "p"}, null), "prescription")
      .operation, "prescription_delete");
});
test("Firestore redelivery creates one immutable record", async () => {
  const {records, service} = fixture();
  const change = event(null, {families: ["a"]});
  await service.recordChange(change, "members");
  await service.recordChange(change, "members");
  assert.equal(records.size, 1);
});
test("unauthenticated and forged session payloads are rejected", async () => {
  const {service, records} = fixture();
  await assert.rejects(service.recordSession({data: {operation: "login"}}),
      {code: "unauthenticated"});
  await assert.rejects(service.recordSession({auth: {uid: "u"},
    data: {operation: "login", actorId: "other"}}), {code: "invalid-argument"});
  assert.equal(records.size, 0);
});
test("session retries deduplicate and use only token identity", async () => {
  const {service, records} = fixture();
  const request = {auth: {uid: "u", token: {auth_time: 100}},
    data: {operation: "login"}};
  await service.recordSession(request);
  await service.recordSession(request);
  assert.equal(records.size, 1);
  assert.equal([...records.values()][0].actorId, "u");
  assert.equal([...records.values()][0].source, "authenticated_client_signal");
});
test("database failures propagate so Firestore delivery can retry", async () => {
  const service = createAuditService({collection: () => ({doc: () => ({
    create: async () => { throw new Error("unavailable"); },
  })})});
  await assert.rejects(service.recordChange(event(null, {a: 1}), "prescription"),
      /unavailable/);
});
