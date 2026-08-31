import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import {
  makeMedicationReminderDocumentId,
  makePrescriptionItemDocumentId,
} from "@/src/data/firestoreDocumentIds";

type PrescriptionItem = {
  itemId?: string;
  drug_name_zh?: string;
  dose?: string;
  time_of_day?: string[] | string;
  feeding_times?: string[] | string;
};

function normalizeTimeOfDay(value?: string[] | string): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v));
  return [String(value)];
}

export function inferScheduleTimesFromText(text: string): string[] {
  const s = String(text).trim().toLowerCase();
  const times = new Set<string>();

  // 英文關鍵字
  if (s.includes("morning")) times.add("08:00");
  if (s.includes("noon") || s.includes("lunch")) times.add("13:00");
  if (s.includes("evening") || s.includes("dinner")) times.add("18:00");
  if (s.includes("night") || s.includes("bedtime")) times.add("21:00");

  // 中文關鍵字
  if (
    s.includes("早上") ||
    s.includes("上午") ||
    s.includes("早餐後") ||
    s.includes("早餐前")
  ) {
    times.add("08:00");
  }

  if (
    s.includes("中午") ||
    s.includes("午餐後") ||
    s.includes("午餐前")
  ) {
    times.add("13:00");
  }

  if (
    s.includes("傍晚") ||
    s.includes("晚上") ||
    s.includes("晚餐後") ||
    s.includes("晚餐前")
  ) {
    times.add("18:00");
  }

  if (
    s.includes("睡前") ||
    s.includes("夜間")
  ) {
    times.add("21:00");
  }

  // 一天三次 / 三餐後
  if (
    s.includes("一天三次") ||
    s.includes("每日三次") ||
    s.includes("三餐後")
  ) {
    times.add("08:00");
    times.add("13:00");
    times.add("18:00");
  }

  // 一天兩次 / 早晚
  if (
    s.includes("一天兩次") ||
    s.includes("每日兩次") ||
    s.includes("早晚")
  ) {
    times.add("08:00");
    times.add("21:00");
  }

  // 每日上午1次
  if (s.includes("每日上午")) {
    times.add("08:00");
  }

  // 每晚 / 每日晚上
  if (s.includes("每晚") || s.includes("每日晚上")) {
    times.add("21:00");
  }

  return [...times];
}

export function normalizeExplicitScheduleTimes(value?: string[] | string): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
    ? value.split(/[，,;；\s]+/)
    : [];

  const normalized = new Set<string>();

  for (const raw of rawValues) {
    const match = String(raw).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) continue;

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) continue;

    normalized.add(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }

  return [...normalized].sort();
}

async function getLinkedPatientContext(patientId: string) {
  const patientRef = doc(db, "patients", patientId);
  const patientSnap = await getDoc(patientRef);

  if (!patientSnap.exists()) {
    return { notifyUserIds: [] as string[], patientsId: "" };
  }

  const patient = patientSnap.data() as {
    patientsId?: string;
    families?: string[];
    caregivers?: string[];
  };

  const families = Array.isArray(patient.families) ? patient.families : [];
  const caregivers = Array.isArray(patient.caregivers) ? patient.caregivers : [];

  return {
    notifyUserIds: [...new Set([...families, ...caregivers])],
    patientsId: String(patient.patientsId ?? "").trim(),
  };
}

export async function createMedicationReminders(params: {
  patientId: string;
  prescriptionId: string;
  items: PrescriptionItem[];
}) {
  const { patientId, prescriptionId, items } = params;

  if (!patientId || !prescriptionId || !Array.isArray(items)) {
    return;
  }

  const [{ notifyUserIds, patientsId }, existingSnap] = await Promise.all([
    getLinkedPatientContext(patientId),
    getDocs(
      query(
        collection(db, "medication_reminders"),
        where("prescriptionId", "==", prescriptionId)
      )
    ),
  ]);
  const existingIds = new Set(existingSnap.docs.map((docSnap) => docSnap.id));
  const desiredIds = new Set<string>();
  const batch = writeBatch(db);

  items.forEach((item, itemIndex) => {
    const medicineName = item.drug_name_zh?.trim() || "未命名藥物";
    const doseText = item.dose?.trim() || "";
    const logicalItemId = makePrescriptionItemDocumentId(itemIndex);
    const prescriptionItemId = item.itemId?.trim() || logicalItemId;

    const explicitScheduleTimes = normalizeExplicitScheduleTimes(item.feeding_times);
    const scheduleTimes = new Set<string>();

    if (explicitScheduleTimes.length > 0) {
      explicitScheduleTimes.forEach((t) => scheduleTimes.add(t));
    } else {
      const rawTimeTexts = normalizeTimeOfDay(item.time_of_day);
      for (const raw of rawTimeTexts) {
        const inferred = inferScheduleTimesFromText(raw);
        inferred.forEach((t) => scheduleTimes.add(t));
      }
    }

    scheduleTimes.forEach((scheduleTime) => {
      const reminderId = makeMedicationReminderDocumentId(
        prescriptionId,
        prescriptionItemId,
        scheduleTime
      );
      const reminderRef = doc(db, "medication_reminders", reminderId);
      desiredIds.add(reminderId);

      batch.set(reminderRef, {
        reminderId,
        patientId,
        patientsId,
        prescriptionId,
        prescriptionItemId,
        itemOrder: itemIndex + 1,
        medicineName,
        doseText,
        scheduleTime,
        notifyUserIds,
        enabled: true,
        updatedAt: serverTimestamp(),
        ...(existingIds.has(reminderId)
          ? {}
          : { lastSentDate: "", createdAt: serverTimestamp() }),
      }, { merge: true });
    });
  });

  existingSnap.docs.forEach((docSnap) => {
    if (desiredIds.has(docSnap.id)) return;
    batch.update(docSnap.ref, {
      enabled: false,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}
