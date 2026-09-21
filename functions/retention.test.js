/* eslint-disable require-jsdoc */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {cutoffDate, isExpired, storagePaths, runRetention} = require("./retention");

test("calendar months clamp leap day in Taipei time", () => {
  assert.equal(cutoffDate(new Date("2024-05-31T19:00:00+08:00"), 3)
      .toISOString(), "2024-02-29T11:00:00.000Z");
});
test("exact boundary and unknown timestamps are retained", () => {
  const cutoff = new Date("2026-01-01T00:00:00Z");
  assert.equal(isExpired({toDate: () => cutoff}, cutoff), false);
  assert.ok(!isExpired(null, cutoff));
  assert.ok(!isExpired("2020-01-01", cutoff));
});
test("storage references require the correct bucket and scoped prefix", () => {
  const url = "https://firebasestorage.googleapis.com/v0/b/bucket/o/";
  const data = {imageUrl: url + "prescriptions%2Fuid%2Fa.jpg?token=secret"};
  assert.deepEqual(storagePaths(data, "bucket", "prescriptions/uid/"),
      ["prescriptions/uid/a.jpg"]);
  assert.throws(() => storagePaths(data, "other", "prescriptions/uid/"));
  assert.throws(() => storagePaths(data, "bucket", "chats/"));
  assert.throws(() => storagePaths({imageUrl: "http://localhost/a"},
      "bucket", "prescriptions/uid/"));
});
test("default dry run never creates jobs, deletes files or documents", async () => {
  const old = {toDate: () => new Date("2000-01-01")};
  const query = {
    where() { return this; }, orderBy() { return this; },
    limit() { return this; },
    async get() {
      return {empty: false, size: 1, docs: [{
        data: () => ({createdAt: old}),
        ref: {path: "chats/p/messages/m", parent: {parent: {id: "p"}}},
      }]};
    },
  };
  const db = {collection: () => query, collectionGroup: () => query};
  const report = await runRetention({db, bucket: {name: "bucket"}});
  assert.equal(report.candidates, 6);
  assert.equal(report.deleted, 0);
  assert.equal(report.failed, 0);
});

function fixture({storageFailure = false, conflict = false} = {}) {
  const tasks = new Map();
  let detached = false;
  let fileDeletes = 0;
  const empty = {empty: true, size: 0, docs: []};
  const row = {id: "old", updateTime: "version1",
    ref: {path: "chats/p/messages/old", parent: {parent: {id: "p"}}},
    data: () => ({createdAt: {toDate: () => new Date("2000-01-01")},
      imageUrl: "https://firebasestorage.googleapis.com/v0/b/b/o/" +
        "chats%2Fp%2Fimages%2Fa.jpg"})};
  const jobRef = {id: "job", delete: async () => tasks.delete("job")};
  const query = (read) => ({
    where() { return this; }, orderBy() { return this; },
    limit() { return this; }, get: read,
  });
  const jobs = {...query(async () => ({docs: [...tasks.values()]})),
    doc: () => jobRef};
  const db = {
    collection: (name) => name === "_retention_jobs" ? jobs :
      query(async () => empty),
    collectionGroup: () => query(async () => detached ? empty :
      {empty: false, size: 1, docs: [row]}),
    batch: () => {
      let task;
      return {
        create: (ref, data) => { task = {ref, data: () => data}; },
        delete: (ref, precondition) => {
          assert.equal(precondition.lastUpdateTime, "version1");
        },
        commit: async () => {
          if (conflict) throw new Error("document changed");
          detached = true;
          tasks.set("job", task);
        },
      };
    },
  };
  const bucket = {name: "b", file: () => ({delete: async () => {
    fileDeletes++;
    assert.equal(detached, true);
    if (storageFailure) throw new Error("storage unavailable");
  }})};
  return {db, bucket, tasks, fileDeletes: () => fileDeletes,
    recover: () => { storageFailure = false; }};
}

test("failed Storage deletion retains a durable job and retry completes it", async () => {
  const f = fixture({storageFailure: true});
  const first = await runRetention({...f, dryRun: false});
  assert.equal(first.deleted, 1);
  assert.equal(first.failed, 1);
  assert.equal(f.tasks.size, 1);
  f.recover();
  const second = await runRetention({...f, dryRun: false});
  assert.equal(second.failed, 0);
  assert.equal(f.tasks.size, 0);
  assert.equal(f.fileDeletes(), 2);
});

test("concurrent document edit prevents deletion of both document and media", async () => {
  const f = fixture({conflict: true});
  const report = await runRetention({...f, dryRun: false});
  assert.equal(report.deleted, 0);
  assert.equal(report.failed, 1);
  assert.equal(f.tasks.size, 0);
  assert.equal(f.fileDeletes(), 0);
});
