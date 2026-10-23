const test = require("node:test");
const assert = require("node:assert/strict");
const {retiredTestPush} = require("./retiredTestPush");

test("retired push does not inspect credentials or target and never returns tokens", () => {
  const req = new Proxy({}, {get: () => {
    throw new Error("Must not inspect or process a target");
  }});
  let status;
  let body;
  const res = {set: () => {}, status: (value) => {
    status = value;
    return res;
  }, json: (value) => { body = value; }};
  retiredTestPush(req, res);
  assert.equal(status, 410);
  assert.deepEqual(Object.keys(body), ["error"]);
});
