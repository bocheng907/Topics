import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";

type PrescriptionItem = {
  drug_name_zh?: string;
  dose?: string;
  time_of_day?: string[] | string;
};

function normalizeTimeOfDay(value?: string[] | string): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v));
  return [String(value)];
}

function inferScheduleTimesFromText(text: string): string[] {
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

async function getLinkedUserIds(patientId: string): Promise<string[]> {
  const patientRef = doc(db, "patients", patientId);
  const patientSnap = await getDoc(patientRef);

  if (!patientSnap.exists()) return [];

  const patient = patientSnap.data() as {
    families?: string[];
    caregivers?: string[];
  };

  const families = Array.isArray(patient.families) ? patient.families : [];
  const caregivers = Array.isArray(patient.caregivers) ? patient.caregivers : [];

  return [...new Set([...families, ...caregivers])];
}

export async function createMedicationReminders(params: {
  patientId: string;
  prescriptionId: string;
  items: PrescriptionItem[];
}) {
  const { patientId, prescriptionId, items } = params;

  if (!patientId || !prescriptionId || !Array.isArray(items) || items.length === 0) {
    return;
  }

  const notifyUserIds = await getLinkedUserIds(patientId);

  for (const item of items) {
    const medicineName = item.drug_name_zh?.trim() || "未命名藥物";
    const doseText = item.dose?.trim() || "";

    const rawTimeTexts = normalizeTimeOfDay(item.time_of_day);
    const scheduleTimes = new Set<string>();

    for (const raw of rawTimeTexts) {
      const inferred = inferScheduleTimesFromText(raw);
      inferred.forEach((t) => scheduleTimes.add(t));
    }

    for (const scheduleTime of scheduleTimes) {
      await addDoc(collection(db, "medication_reminders"), {
        patientId,
        prescriptionId,
        medicineName,
        doseText,
        scheduleTime,
        notifyUserIds,
        enabled: true,
        lastSentDate: "",
        createdAt: serverTimestamp(),
      });
    }
  }
}