import { after, before, beforeEach, describe, test } from "node:test";
import { randomUUID } from "node:crypto";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, Timestamp,
  updateDoc, where, writeBatch,
} from "firebase/firestore";
import { authed, createEnv, PATIENT_ID, seedPatient, seedUser, uid } from "./helpers.mjs";

const FAM = uid("family");
const CG = uid("caregiver");
const OUT = uid("outsider");
const PRES = "2026-10-18_10-00-00-000_prescription_pat_XYZWAB12";

let env;
before(async () => { env = await createEnv(); });
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seedUser(env, FAM, "family");
  await seedUser(env, CG, "caregiver");
  await seedUser(env, OUT, "family");
  await seedPatient(env, { families: [FAM], caregivers: [CG] });
});

function createPrescriptionBatch(db, by) {
  const batch = writeBatch(db);
  batch.set(doc(db, "prescriptions", PRES), {
    createdBy: by, patientId: PATIENT_ID, patientsId: "XYZWAB12", sourceImageUrl: "", status: "parsed",
    title: "藥單", createdAt: serverTimestamp(), clinic_name: "", department: "", visit_date: "",
    patient_name: "", memo: "", aiRaw: {},
  });
  batch.set(doc(db, "prescriptions", PRES, "items", "item-01"), {
    itemId: "item-01", drug_name_zh: "普拿疼", dose: "1 顆", usage_zh: "早餐後", feeding_times: ["08:00"],
  });
  batch.set(doc(db, "medication_reminders", `${PRES}_reminder_item-01_08-00`), {
    reminderId: `${PRES}_reminder_item-01_08-00`, patientId: PATIENT_ID, prescriptionId: PRES,
    prescriptionItemId: "item-01", scheduleTime: "08:00", enabled: true, notifyUserIds: [FAM, CG],
    updatedAt: serverTimestamp(), lastSentDate: "", createdAt: serverTimestamp(),
  }, { merge: true });
  return batch.commit();
}

describe("care target access", () => {
  test("members read the patient, outsiders cannot; membership queries work", async () => {
    await assertSucceeds(getDoc(doc(authed(env, FAM), "patients", PATIENT_ID)));
    await assertSucceeds(getDoc(doc(authed(env, CG), "patients", PATIENT_ID)));
    await assertFails(getDoc(doc(authed(env, OUT), "patients", PATIENT_ID)));
    await assertSucceeds(getDocs(query(collection(authed(env, FAM), "patients"),
      where("families", "array-contains", FAM))));
    await assertSucceeds(getDocs(query(collection(authed(env, CG), "patients"),
      where("caregivers", "array-contains", CG))));
  });

  test("patients are created by the callable only; membership arrays are immutable", async () => {
    await assertFails(setDoc(doc(authed(env, FAM), "patients", "new_pat"), { name: "x" }));
    await assertFails(updateDoc(doc(authed(env, CG), "patients", PATIENT_ID), { families: [FAM, CG] }));
    await assertSucceeds(updateDoc(doc(authed(env, FAM), "patients", PATIENT_ID),
      { emergencyPhone1: "0911111111", emergencyPhone2: "0922222222" }));
    await assertFails(updateDoc(doc(authed(env, FAM), "patients", PATIENT_ID), { familyGroupId: "other" }));
  });

  test("care handbook: family writes, caregiver reads", async () => {
    const payload = (by) => ({
      patientId: PATIENT_ID, dailyRoutine: "早上散步", medicationNotes: "", dietNotes: "", mobilityNotes: "",
      hygieneNotes: "", sleepNotes: "", communicationNotes: "", emergencyNotes: "", otherNotes: "",
      updatedAt: serverTimestamp(), updatedBy: by,
    });
    const ref = (db) => doc(db, "patients", PATIENT_ID, "care_handbook", "main");
    const writeRevision = (id, revision, baseRevision) => {
      const db = authed(env, id);
      const batch = writeBatch(db);
      batch.set(ref(db), { ...payload(id), revision, baseRevision });
      batch.set(doc(db, "patients", PATIENT_ID, "care_handbook_revisions", revision), { createdAt: serverTimestamp() });
      return batch.commit();
    };
    await assertSucceeds(getDoc(ref(authed(env, CG))));
    await assertFails(setDoc(ref(authed(env, FAM)), payload(FAM), { merge: true }));
    const first = randomUUID(), second = randomUUID();
    await assertSucceeds(writeRevision(FAM, first, ""));
    await assertSucceeds(writeRevision(FAM, second, first));
    await assertFails(writeRevision(FAM, randomUUID(), first));
    await assertFails(writeRevision(CG, randomUUID(), second));
    await assertSucceeds(getDoc(ref(authed(env, CG))));
    await assertFails(setDoc(ref(authed(env, CG)), payload(CG), { merge: true }));
    await assertFails(getDoc(ref(authed(env, OUT))));
  });
});

describe("prescriptions", () => {
  test("caregiver creates prescription + items + reminders in one batch", async () => {
    await assertSucceeds(createPrescriptionBatch(authed(env, CG), CG));
    await assertSucceeds(getDocs(query(collection(authed(env, FAM), "prescriptions"),
      where("patientId", "==", PATIENT_ID))));
    await assertSucceeds(getDocs(collection(authed(env, FAM), "prescriptions", PRES, "items")));
    await assertFails(getDocs(query(collection(authed(env, OUT), "prescriptions"),
      where("patientId", "==", PATIENT_ID))));
  });

  test("family cannot create, but can edit and delete", async () => {
    await assertFails(createPrescriptionBatch(authed(env, FAM), FAM));
    await createPrescriptionBatch(authed(env, CG), CG);
    const fam = authed(env, FAM);
    const batch = writeBatch(fam);
    batch.update(doc(fam, "prescriptions", PRES), { title: "改過的藥單", updatedAt: serverTimestamp() });
    batch.update(doc(fam, "prescriptions", PRES, "items", "item-01"), { dose: "2 顆", drug_name_en: "Panadol" });
    await assertSucceeds(batch.commit());
    await assertFails(updateDoc(doc(fam, "prescriptions", PRES), { createdBy: FAM }));
    // Same delete batch as list.tsx: items + reminders + parent.
    const reminders = await getDocs(query(collection(fam, "medication_reminders"),
      where("patientId", "==", PATIENT_ID), where("prescriptionId", "==", PRES)));
    const del = writeBatch(fam);
    del.delete(doc(fam, "prescriptions", PRES, "items", "item-01"));
    reminders.docs.forEach((r) => del.delete(r.ref));
    del.delete(doc(fam, "prescriptions", PRES));
    await assertSucceeds(del.commit());
  });

  test("outsider cannot delete or edit", async () => {
    await createPrescriptionBatch(authed(env, CG), CG);
    await assertFails(deleteDoc(doc(authed(env, OUT), "prescriptions", PRES)));
    await assertFails(updateDoc(doc(authed(env, OUT), "prescriptions", PRES), { title: "x" }));
  });

  test("medication log by a linked member", async () => {
    await assertSucceeds(setDoc(doc(authed(env, CG), "medication_logs", "2026-10-18_medlog_x"), {
      logId: "2026-10-18_medlog_x", patientId: PATIENT_ID, confirmedBy: CG, status: "taken",
      takenAt: serverTimestamp(), dateKey: "2026-10-18",
    }));
    await assertFails(setDoc(doc(authed(env, OUT), "medication_logs", "2026-10-18_medlog_y"), {
      patientId: PATIENT_ID, confirmedBy: OUT,
    }));
  });
});

describe("calendar, checklists, health, records", () => {
  test("calendar event create, edit (with *_zh fields), complete, delete", async () => {
    const cg = authed(env, CG);
    const id = "2026-10-20_09-15-00-123_AB12";
    const mutable = {
      name: "王醫師", personName: "王醫師", name_zh: "王醫師", title: "回診", eventTitle: "回診", title_zh: "回診",
      location: "台大", location_zh: "台大", color: "#4A90E2", startAt: Timestamp.now(), eventDate: "2026-10-20",
      hour: "9", minute: "15", period: "am", updatedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(cg, "calendar_events", id), {
      patientId: PATIENT_ID, patientsId: "XYZWAB12", createdBy: CG, createdAt: serverTimestamp(),
      isCompleted: false, ...mutable,
    }));
    const fam = authed(env, FAM);
    await assertSucceeds(updateDoc(doc(fam, "calendar_events", id),
      { ...mutable, title: "復健", title_zh: "復健", location_zh: "榮總" }));
    await assertFails(updateDoc(doc(fam, "calendar_events", id), { title_zh: { bad: true } }));
    await assertFails(updateDoc(doc(fam, "calendar_events", id), { patientId: "other" }));
    await assertSucceeds(updateDoc(doc(fam, "calendar_events", id),
      { isCompleted: true, completedAt: serverTimestamp(), completedBy: FAM, updatedAt: serverTimestamp() }));
    await assertSucceeds(getDocs(query(collection(fam, "calendar_events"), where("patientId", "==", PATIENT_ID))));
    await assertSucceeds(addDoc(collection(fam, "calendar_events"), {
      patientId: PATIENT_ID, createdBy: FAM, createdAt: serverTimestamp(), isCompleted: false, ...mutable,
    }));
    await assertFails(getDocs(query(collection(authed(env, OUT), "calendar_events"),
      where("patientId", "==", PATIENT_ID))));
    await assertSucceeds(deleteDoc(doc(fam, "calendar_events", id)));
  });

  test("daily checklist parent + items by caregiver; family reads", async () => {
    const cg = authed(env, CG);
    const dc = "2026-10-18_checklist_pat_XYZWAB12";
    await assertSucceeds(setDoc(doc(cg, "daily_checklist_items", dc), {
      patientId: PATIENT_ID, patientsId: "XYZWAB12", dateKey: "2026-10-18", dailyChecklistDocId: dc,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: CG,
    }, { merge: true }));
    await assertSucceeds(setDoc(doc(cg, "daily_checklist_items", dc, "items", "default-1"), {
      title: "量血壓", completed: false, isDefault: true, createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(), completedAt: null, createdBy: CG, caregiverId: CG, patientId: PATIENT_ID,
      patientsId: "XYZWAB12", dateKey: "2026-10-18", dailyChecklistDocId: dc,
    }));
    await assertSucceeds(updateDoc(doc(cg, "daily_checklist_items", dc, "items", "default-1"),
      { completed: true, completedAt: serverTimestamp(), caregiverId: CG, updatedAt: serverTimestamp() }));
    await assertSucceeds(getDocs(query(collection(authed(env, FAM), "daily_checklist_items", dc, "items"),
      where("patientId", "==", PATIENT_ID))));
  });

  test("health record by caregiver; thresholds by family; missing threshold readable", async () => {
    await assertSucceeds(setDoc(doc(authed(env, CG), "health_records", "2026-10-18_10-00-00_rec_AB12"), {
      patientId: PATIENT_ID, caregiverId: CG, createdAt: serverTimestamp(), temperature: 36.5,
      bloodSugar: 110, bloodSugarType: "空腹",
    }));
    await assertSucceeds(getDocs(query(collection(authed(env, FAM), "health_records"),
      where("patientId", "==", PATIENT_ID))));
    await assertSucceeds(getDoc(doc(authed(env, CG), "health_thresholds", "threshold_pat_XYZWAB12")));
    await assertSucceeds(setDoc(doc(authed(env, FAM), "health_thresholds", "threshold_pat_XYZWAB12"), {
      thresholdId: "threshold_pat_XYZWAB12", patientDocId: PATIENT_ID, patientsId: "XYZWAB12",
      temperature: { max: 37.5 }, updatedAt: serverTimestamp(),
    }, { merge: true }));
    await assertFails(getDoc(doc(authed(env, OUT), "health_thresholds", "threshold_pat_XYZWAB12")));
  });

  test("abnormal records by caregiver, voice records by family", async () => {
    const rec = "2026-10-18_10-00-00_abnormal_AB12";
    await assertSucceeds(setDoc(doc(authed(env, CG), "abnormal_records", rec), {
      patientId: PATIENT_ID, caregiverId: CG, createdAt: serverTimestamp(), titleOriginal: "跌倒",
      titleZh: "", notesOriginal: "", notesZh: "", type: "folder", entries: [],
    }));
    await assertSucceeds(updateDoc(doc(authed(env, CG), "abnormal_records", rec), { titleOriginal: "跌倒（輕微）" }));
    await assertFails(setDoc(doc(authed(env, FAM), "abnormal_records", "x"), {
      patientId: PATIENT_ID, caregiverId: FAM,
    }));
    await assertSucceeds(setDoc(doc(authed(env, FAM), "voice_records", "2026-10-18_10-00-00_voice_AB12"), {
      patientId: PATIENT_ID, familyId: FAM, title: "吃藥", audioUrl: "https://x", createdAt: serverTimestamp(),
    }));
    await assertSucceeds(getDocs(query(collection(authed(env, CG), "voice_records"),
      where("patientId", "==", PATIENT_ID))));
  });

  test("care notes (top-level) by caregiver", async () => {
    const id = "2026-10-18_10-00-00-000_note_pat_XYZWAB12";
    const cg = authed(env, CG);
    await assertSucceeds(setDoc(doc(cg, "care_notes", id), {
      patientDocId: PATIENT_ID, patientId: "XYZWAB12", caregiverUid: CG, title: "t", content: "c",
      language: "zh", isPinned: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(getDocs(query(collection(cg, "care_notes"),
      where("patientDocId", "==", PATIENT_ID), where("caregiverUid", "==", CG))));
    await assertSucceeds(updateDoc(doc(cg, "care_notes", id), { isPinned: true, updatedAt: serverTimestamp() }));
  });

  test("notifications: recipient reads and marks read only", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "notifications", "n1"),
      { recipientUid: FAM, isRead: false, title: "x" }));
    await assertSucceeds(getDocs(query(collection(authed(env, FAM), "notifications"),
      where("recipientUid", "==", FAM))));
    await assertSucceeds(updateDoc(doc(authed(env, FAM), "notifications", "n1"), { isRead: true }));
    await assertFails(updateDoc(doc(authed(env, FAM), "notifications", "n1"), { title: "y" }));
    await assertFails(getDoc(doc(authed(env, CG), "notifications", "n1")));
  });
});

describe("chat", () => {
  const msg = (sender, extra = {}) => ({
    text: "你好", text_zh: "你好", text_original: "你好", senderId: sender, senderName: "我",
    senderAvatarUrl: "", createdAt: serverTimestamp(), ...extra,
  });

  test("caregiver room for all members, family room for families only", async () => {
    await assertSucceeds(setDoc(doc(authed(env, CG), "chats", PATIENT_ID, "messages", "m1"), msg(CG)));
    await assertSucceeds(setDoc(doc(authed(env, FAM), "chats", PATIENT_ID, "messages", "m2"), msg(FAM)));
    await assertSucceeds(setDoc(doc(authed(env, FAM), "chats", PATIENT_ID, "familyMessages", "m3"), msg(FAM)));
    await assertFails(setDoc(doc(authed(env, CG), "chats", PATIENT_ID, "familyMessages", "m4"), msg(CG)));
    await assertFails(getDocs(collection(authed(env, CG), "chats", PATIENT_ID, "familyMessages")));
    await assertSucceeds(getDocs(query(collection(authed(env, CG), "chats", PATIENT_ID, "messages"),
      orderBy("createdAt", "asc"))));
    await assertFails(getDocs(collection(authed(env, OUT), "chats", PATIENT_ID, "messages")));
  });

  test("image messages, impersonation and edits", async () => {
    const { text, text_zh, text_original, ...base } = msg(CG);
    void text; void text_zh; void text_original;
    await assertSucceeds(setDoc(doc(authed(env, CG), "chats", PATIENT_ID, "messages", "img"),
      { ...base, imageUrl: "https://example.com/i.jpg" }));
    await assertFails(setDoc(doc(authed(env, CG), "chats", PATIENT_ID, "messages", "fake"), msg(FAM)));
    await assertFails(updateDoc(doc(authed(env, CG), "chats", PATIENT_ID, "messages", "img"), { imageUrl: "x" }));
  });
});
