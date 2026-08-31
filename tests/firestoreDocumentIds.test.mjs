import assert from "node:assert/strict";
import test from "node:test";

import {
  getPatientDocumentCode,
  makeCareNoteDocumentId,
  makeDailyChecklistDocumentId,
  makeHealthThresholdDocumentId,
  makeMedicationLogDocumentId,
  makeMedicationReminderDocumentId,
  makeNotificationDocumentId,
  makePrescriptionDocumentId,
  makePrescriptionItemDocumentId,
} from "../src/data/firestoreDocumentIds.ts";

test("完整 patientsId 優先於舊病患文件末四碼", () => {
  assert.equal(
    getPatientDocumentCode({
      patientDocId: "2026-04-18_02-24-09_pat_CE5S",
      patientsId: "7kdmce5s",
    }),
    "7KDMCE5S"
  );
});

test("缺少 patientsId 時仍可讀取舊病患文件代碼", () => {
  assert.equal(
    getPatientDocumentCode({
      patientDocId: "2026-04-18_02-24-09_pat_CE5S",
    }),
    "CE5S"
  );
});

test("每日清單文件 ID 僅包含工作日期、類型及完整病患碼", () => {
  assert.equal(
    makeDailyChecklistDocumentId("2026-05-01", {
      patientDocId: "2026-04-18_02-24-09_pat_CE5S",
      patientsId: "7KDMCE5S",
    }),
    "2026-05-01_checklist_pat_7KDMCE5S"
  );
});

test("記事文件 ID 包含毫秒及完整病患碼", () => {
  const createdAt = new Date(2026, 4, 1, 14, 32, 18, 527);

  assert.equal(
    makeCareNoteDocumentId(
      {
        patientDocId: "2026-04-18_02-24-09_pat_CE5S",
        patientsId: "7KDMCE5S",
      },
      createdAt
    ),
    "2026-05-01_14-32-18-527_note_pat_7KDMCE5S"
  );
});

test("拒絕格式錯誤的清單日期", () => {
  assert.throws(
    () =>
      makeDailyChecklistDocumentId("2026/05/01", {
        patientsId: "7KDMCE5S",
      }),
    /Invalid Firestore date key/
  );
});

test("藥單與藥品項目 ID 使用完整病患碼及固定序號", () => {
  const createdAt = new Date(2026, 7, 16, 9, 30, 12, 123);

  assert.equal(
    makePrescriptionDocumentId({ patientsId: "7kdmce5s" }, createdAt),
    "2026-08-16_09-30-12-123_prescription_pat_7KDMCE5S"
  );
  assert.equal(makePrescriptionItemDocumentId(0), "item-01");
  assert.equal(makePrescriptionItemDocumentId(11), "item-12");
});

test("健康閾值 ID 每位病患固定一份", () => {
  assert.equal(
    makeHealthThresholdDocumentId({ patientsId: "7KDMCE5S" }),
    "threshold_pat_7KDMCE5S"
  );
});

test("用藥提醒 ID 由藥單、項目及時間唯一決定", () => {
  assert.equal(
    makeMedicationReminderDocumentId(
      "2026-08-16_09-30-12-123_prescription_pat_7KDMCE5S",
      "item-01",
      "08:00"
    ),
    "2026-08-16_09-30-12-123_prescription_pat_7KDMCE5S_reminder_item-01_08-00"
  );
});

test("服藥紀錄 ID 由日期與提醒唯一決定", () => {
  assert.equal(
    makeMedicationLogDocumentId("2026-08-16", "reminder/item 01"),
    "2026-08-16_medlog_reminder-item-01"
  );
});

test("通知 ID 包含日期、類型、來源及收件者末八碼", () => {
  assert.equal(
    makeNotificationDocumentId({
      dateKey: "2026-08-16",
      type: "medication_done",
      sourceCollection: "medication_logs",
      sourceId: "2026-08-16_medlog_reminder-01",
      recipientUid: "firebase-user-A1B2C3D4",
    }),
    "2026-08-16_notification_medication_done_medication_logs_2026-08-16_medlog_reminder-01_to_A1B2C3D4"
  );
});

test("拒絕無效提醒時間及負數項目序號", () => {
  assert.throws(
    () => makeMedicationReminderDocumentId("prescription-1", "item-01", "8:00"),
    /Invalid Firestore schedule time/
  );
  assert.throws(
    () => makePrescriptionItemDocumentId(-1),
    /Invalid prescription item index/
  );
});
