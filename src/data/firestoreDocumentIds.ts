export type PatientIdentity = {
  patientDocId?: string | null;
  patientsId?: string | null;
};

function normalizePatientCode(value?: string | null) {
  return String(value ?? "")
    .trim()
    .replace(/^pat_/i, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

export function getPatientDocumentCode({
  patientDocId,
  patientsId,
}: PatientIdentity) {
  const fullPatientsId = normalizePatientCode(patientsId);
  if (fullPatientsId) return fullPatientsId;

  const normalizedDocId = String(patientDocId ?? "").trim();
  const patientCodeMatch = normalizedDocId.match(
    /(?:^|_)pat_([A-Za-z0-9]+)(?:_|$)/i
  );
  if (patientCodeMatch?.[1]) {
    return normalizePatientCode(patientCodeMatch[1]);
  }

  return normalizePatientCode(normalizedDocId.slice(-4));
}

function assertDateKey(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`Invalid Firestore date key: ${dateKey}`);
  }
}

function normalizeIdSegment(value: string, label: string) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) {
    throw new Error(`Missing ${label} for Firestore document ID`);
  }

  return normalized;
}

function assertScheduleTime(scheduleTime: string) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(scheduleTime)) {
    throw new Error(`Invalid Firestore schedule time: ${scheduleTime}`);
  }
}

function requirePatientCode(identity: PatientIdentity) {
  const patientCode = getPatientDocumentCode(identity);
  if (!patientCode) {
    throw new Error("Missing patient code for Firestore document ID");
  }
  return patientCode;
}

function pad(value: number, width = 2) {
  return String(value).padStart(width, "0");
}

function makeLocalDateTimePart(date: Date, label: string) {
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date for Firestore ${label} document ID`);
  }

  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
  const timePart = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(
    date.getSeconds()
  )}-${pad(date.getMilliseconds(), 3)}`;

  return `${datePart}_${timePart}`;
}

export function makeDailyChecklistDocumentId(
  dateKey: string,
  identity: PatientIdentity
) {
  assertDateKey(dateKey);
  const patientCode = requirePatientCode(identity);
  return `${dateKey}_checklist_pat_${patientCode}`;
}

export function makeCareNoteDocumentId(
  identity: PatientIdentity,
  date = new Date()
) {
  const patientCode = requirePatientCode(identity);
  const dateTimePart = makeLocalDateTimePart(date, "care note");

  return `${dateTimePart}_note_pat_${patientCode}`;
}

export function makePrescriptionDocumentId(
  identity: PatientIdentity,
  date = new Date()
) {
  const patientCode = requirePatientCode(identity);
  const dateTimePart = makeLocalDateTimePart(date, "prescription");

  return `${dateTimePart}_prescription_pat_${patientCode}`;
}

export function makePrescriptionItemDocumentId(index: number) {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid prescription item index: ${index}`);
  }

  return `item-${pad(index + 1)}`;
}

export function makeHealthThresholdDocumentId(identity: PatientIdentity) {
  const patientCode = requirePatientCode(identity);
  return `threshold_pat_${patientCode}`;
}

export function makeMedicationReminderDocumentId(
  prescriptionId: string,
  prescriptionItemId: string,
  scheduleTime: string
) {
  assertScheduleTime(scheduleTime);
  const prescriptionSegment = normalizeIdSegment(
    prescriptionId,
    "prescription ID"
  );
  const itemSegment = normalizeIdSegment(
    prescriptionItemId,
    "prescription item ID"
  );

  return `${prescriptionSegment}_reminder_${itemSegment}_${scheduleTime.replace(
    ":",
    "-"
  )}`;
}

export function makeMedicationLogDocumentId(
  dateKey: string,
  reminderId: string
) {
  assertDateKey(dateKey);
  const reminderSegment = normalizeIdSegment(reminderId, "reminder ID");
  return `${dateKey}_medlog_${reminderSegment}`;
}

export function makeNotificationDocumentId(params: {
  dateKey: string;
  type: string;
  sourceCollection: string;
  sourceId: string;
  recipientUid: string;
}) {
  assertDateKey(params.dateKey);
  const type = normalizeIdSegment(params.type, "notification type");
  const sourceCollection = normalizeIdSegment(
    params.sourceCollection,
    "notification source collection"
  );
  const sourceId = normalizeIdSegment(
    params.sourceId,
    "notification source ID"
  );
  const recipientUid = normalizeIdSegment(
    params.recipientUid,
    "notification recipient UID"
  );
  const recipientSuffix = recipientUid.slice(-8);

  return `${params.dateKey}_notification_${type}_${sourceCollection}_${sourceId}_to_${recipientSuffix}`;
}

// ─────────────────────────────────────────
// 照顧者知識共享（社群）
// 社群內容不隸屬於特定長輩，因此 ID 以「時間 + 發文者尾碼」組成
// ─────────────────────────────────────────

/** 文章 ID：2026-10-12_14-30-05-123_post_a1b2c3d4 */
export function makeCommunityPostDocumentId(authorUid: string, date = new Date()) {
  const uid = normalizeIdSegment(authorUid, "community post author UID");
  return `${makeLocalDateTimePart(date, "community post")}_post_${uid.slice(-8)}`;
}

/** 留言 ID：2026-10-12_14-31-02-456_comment_a1b2c3d4 */
export function makeCommunityCommentDocumentId(authorUid: string, date = new Date()) {
  const uid = normalizeIdSegment(authorUid, "community comment author UID");
  return `${makeLocalDateTimePart(date, "community comment")}_comment_${uid.slice(-8)}`;
}

/**
 * 檢舉 ID：{postId}_by_{檢舉人 uid}
 * 用組合鍵當文件 ID，天然防止同一人重複檢舉同一篇文章；
 * Security Rules 會用同樣的組合確認檢舉次數 +1 時確實寫了自己的檢舉紀錄
 * （使用完整 uid，避免兩個帳號尾碼相同時互相擋住）
 */
export function makeCommunityReportDocumentId(postId: string, reporterUid: string) {
  const post = normalizeIdSegment(postId, "community report post ID");
  const uid = normalizeIdSegment(reporterUid, "community report reporter UID");
  return `${post}_by_${uid}`;
}
