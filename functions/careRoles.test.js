const {test} = require("node:test");
const assert = require("node:assert/strict");
const {primaryUid, secondaryFamilyUids, canTransferPrimary} =
  require("./careRoles");

const patient = {createdBy: "owner", primaryFamilyUid: "owner",
  families: ["owner", "secondary", "secondary"], caregivers: ["care"]};
test("primary and unique secondary families are derived safely", () => {
  assert.equal(primaryUid(patient), "owner");
  assert.deepEqual(secondaryFamilyUids(patient), ["secondary"]);
});
test("only current primary can transfer to current secondary", () => {
  assert.equal(canTransferPrimary(patient, "owner", "secondary"), true);
  assert.equal(canTransferPrimary(patient, "secondary", "owner"), false);
  assert.equal(canTransferPrimary(patient, "owner", "care"), false);
  assert.equal(canTransferPrimary(patient, "owner", "outsider"), false);
});
test("empty explicit primary cannot be claimed through createdBy fallback", () => {
  const orphaned = {...patient, primaryFamilyUid: ""};
  assert.equal(primaryUid(orphaned), null);
  assert.deepEqual(secondaryFamilyUids(orphaned), []);
  assert.equal(canTransferPrimary(orphaned, "owner", "secondary"), false);
});
