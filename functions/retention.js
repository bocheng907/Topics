/* eslint-disable require-jsdoc */
const {URL} = require("node:url");
const POLICIES = [
  ["health_records", 60], ["prescriptions", 36],
  ["abnormal_records", 12], ["notifications", 3], ["audit_logs", 12],
];

function cutoffDate(now, months) {
  const date = new Date(now.getTime() + 8 * 3600000);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - months);
  const end = new Date(date);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  date.setUTCDate(Math.min(day, end.getUTCDate()));
  return new Date(date.getTime() - 8 * 3600000);
}

function isExpired(value, cutoff) {
  return value && typeof value.toDate === "function" &&
    value.toDate().getTime() < cutoff.getTime();
}

function storagePaths(data, bucket, prefix) {
  const result = new Set();
  for (const row of [data, ...(data.entries || [])]) {
    for (const field of ["sourceImageUrl", "imageUrl", "image_url", "mediaUrl"]) {
      if (!row[field]) continue;
      const url = new URL(row[field]);
      const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (url.protocol !== "https:" ||
          url.hostname !== "firebasestorage.googleapis.com" || !match ||
          decodeURIComponent(match[1]) !== bucket) {
        throw new Error("Invalid retention storage reference");
      }
      const path = decodeURIComponent(match[2]);
      if (!prefix || !path.startsWith(prefix) || path.includes("..")) {
        throw new Error("Storage reference outside retention scope");
      }
      result.add(path);
    }
  }
  return [...result];
}

async function runRetention({db, bucket, dryRun = true, now = new Date(),
  maxPages = 10, pageSize = 100}) {
  const report = {dryRun, deleted: 0, candidates: 0, skipped: 0, failed: 0};
  const jobs = db.collection("_retention_jobs");
  async function finishJob(job) {
    const task = job.data();
    for (const path of task.paths) {
      await bucket.file(path).delete({ignoreNotFound: true});
    }
    if (task.collection === "prescriptions") {
      await db.recursiveDelete(db.doc(task.path).collection("items"));
      const reminders = await db.collection("medication_reminders")
          .where("prescriptionId", "==", task.id).get();
      for (const reminder of reminders.docs) {
        await reminder.ref.delete({lastUpdateTime: reminder.updateTime});
      }
    }
    await job.ref.delete();
  }
  if (!dryRun) {
    const pending = await jobs.limit(pageSize).get();
    for (const job of pending.docs) {
      try {
        await finishJob(job);
      } catch (_) {
        report.failed++;
      }
    }
  }
  const scopes = POLICIES.map(([name, months]) => ({
    ref: db.collection(name), months, name,
  }));
  scopes.push({ref: db.collectionGroup("messages"), months: 6, name: "messages"});
  for (const scope of scopes) {
    const cutoff = cutoffDate(now, scope.months);
    let cursor;
    for (let page = 0; page < maxPages; page++) {
      let query = scope.ref.where("createdAt", "<", cutoff)
          .orderBy("createdAt").limit(pageSize);
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.get();
      if (snapshot.empty) break;
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (!isExpired(data.createdAt, cutoff) ||
            (scope.name === "messages" &&
              !/^chats\/[^/]+\/messages\/[^/]+$/.test(doc.ref.path)) ||
            (Array.isArray(data.entries) &&
              !data.entries.every((e) => isExpired(e.createdAt, cutoff)))) {
          report.skipped++;
          continue;
        }
        report.candidates++;
        try {
          const prefix = scope.name === "prescriptions" ?
            `prescriptions/${data.createdBy}/` :
            scope.name === "abnormal_records" ?
              `abnormal_media/${data.patientId}/` :
              scope.name === "messages" ?
                `chats/${doc.ref.parent.parent.id}/images/` : null;
          const paths = storagePaths(data, bucket.name, prefix);
          if (dryRun) continue;
          // Atomic detach prevents deleting media for a concurrently edited row.
          // Durable job survives Storage failures and process termination.
          const jobRef = jobs.doc();
          const task = {paths, path: doc.ref.path, id: doc.id,
            collection: scope.name};
          const batch = db.batch();
          batch.create(jobRef, task);
          batch.delete(doc.ref, {lastUpdateTime: doc.updateTime});
          await batch.commit();
          report.deleted++;
          await finishJob({ref: jobRef, data: () => task});
        } catch (_) {
          report.failed++;
        }
      }
      cursor = snapshot.docs[snapshot.docs.length - 1];
      if (snapshot.size < pageSize) break;
    }
  }
  return report;
}

module.exports = {cutoffDate, isExpired, storagePaths, runRetention};
