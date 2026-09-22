/* eslint-disable require-jsdoc */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {Timestamp} = require("firebase-admin/firestore");
const {joinDecision} = require("./careTargetAccess");
const day = 86400000;
const issued = 1700000000000;
const patient = () => ({families: ["owner"], caregivers: [],
  createdAt: Timestamp.fromMillis(issued)});
for (const [name, now, allowed] of [
  ["issue time", issued, true], ["before deadline", issued + day - 1, true],
  ["exact deadline", issued + day, false], ["expired", issued + day + 1, false],
  ["future timestamp", issued - 1, false],
]) {
  test("invite boundary: " + name, () => {
    if (allowed) {
      assert.deepEqual(joinDecision(patient(), "new", "family", now),
          {field: "families", alreadyJoined: false});
    } else {
      assert.throws(() => joinDecision(patient(), "new", "family", now),
          {code: "not-found"});
    }
  });
}
test("missing or string timestamps fail closed", () => {
  for (const createdAt of [undefined, "yesterday", 123]) {
    assert.throws(() => joinDecision({...patient(), createdAt},
        "new", "caregiver", issued), {code: "not-found"});
  }
});
test("existing member retry does not extend invitation", () => {
  assert.deepEqual(joinDecision(patient(), "owner", "family", issued + day),
      {field: "families", alreadyJoined: true});
});

test("expired invitation includes a stable feedback reason", () => {
  assert.throws(() => joinDecision(patient(), "new", "family", issued + day),
      (error) => error.code === "not-found" && error.details.reason === "expired");
});
test("caregiver cannot promote themself to family", () => {
  assert.throws(() => joinDecision({...patient(), caregivers: ["care"]},
      "care", "family", issued), {code: "permission-denied"});
});
test("malformed membership and unknown role denied", () => {
  for (const data of [{...patient(), families: {}},
    {...patient(), caregivers: [123]}]) {
    assert.throws(() => joinDecision(data, "new", "family", issued),
        {code: "failed-precondition"});
  }
  assert.throws(() => joinDecision(patient(), "new", "admin", issued),
      {code: "failed-precondition"});
});
test("member count bounded", () => {
  assert.throws(() => joinDecision({...patient(),
    caregivers: Array.from({length: 100}, (_, i) => "u" + i)},
  "new", "caregiver", issued), {code: "resource-exhausted"});
});
