// app/caregiver/index.tsx
import { db } from "@/firebase/firebaseConfig";
import { router } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import {
  getPatientDocumentCode,
  makeMedicationLogDocumentId,
} from "@/src/data/firestoreDocumentIds";

type CareTarget = {
  id: string;
  name: string;
  notes?: string;
  inviteCode?: string;
  createdAt?: number;
  updatedAt?: number;
};

type Reminder = {
  id: string;
  patientId: string;
  prescriptionId?: string;
  medicineName: string;
  doseText: string;
  scheduleTime: string;
  enabled: boolean;
  notifyUserIds?: string[];
  lastSentDate?: string;
  createdAt?: any;
};

type MedicationLog = {
  id: string;
  reminderId: string;
  reminderIds?: string[];
  patientId: string;
  dateKey: string;
  scheduleTime?: string;
};

// DONE 只在預定餵藥時間附近開放。
// 若未來要調整時段，只需修改這兩個常數。
const DONE_WINDOW_BEFORE_MINUTES = 30;
const DONE_WINDOW_AFTER_MINUTES = 60;

function getTaipeiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getTaipeiMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function medicationLogId(
  patientId: string,
  patientsId: string | undefined,
  dateKey: string,
  scheduleTime: string
) {
  const patientCode = getPatientDocumentCode({ patientDocId: patientId, patientsId });
  return makeMedicationLogDocumentId(
    dateKey,
    `slot_pat_${patientCode}_${scheduleTime.replace(":", "-")}`
  );
}

function hhmmToMinutes(hhmm?: string) {
  if (!hhmm || !hhmm.includes(":")) return Number.MAX_SAFE_INTEGER;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export default function CaregiverHomeScreen() {
  const { user } = useAuth();
  const { activePatient, activePatientId, ready } = useActiveCareTarget();
  const { language } = useLanguage();
  const t = translations[language];
  const hasLoadedOnceRef = useRef(false);

  const [target, setTarget] = useState<CareTarget | null>(null);
  const [loading, setLoading] = useState(true);

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [todayLogs, setTodayLogs] = useState<MedicationLog[]>([]);
  const [doneLoading, setDoneLoading] = useState(false);
  const [clock, setClock] = useState(() => ({
    dateKey: getTaipeiDateKey(),
    minutes: getTaipeiMinutes(),
  }));

  const todayKey = clock.dateKey;

  // 每分鐘更新一次，讓 DONE 能在餵藥時段到達時自動開啟，跨日也會自動切換。
  useEffect(() => {
    const refreshClock = () => {
      setClock({
        dateKey: getTaipeiDateKey(),
        minutes: getTaipeiMinutes(),
      });
    };

    refreshClock();
    const timer = setInterval(refreshClock, 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  // ==========================================
  // 邏輯：防呆與權限檢查 (沒有長輩則去加入)
  // ==========================================
  useEffect(() => {
    if (!ready) return;
    if (!user) return;

    setLoading(true);

    if (!activePatient || !activePatientId) {
      setTarget(null);
      setLoading(false);
      router.replace("/care-target/join");
      return;
    }

    setTarget(activePatient as CareTarget);
    setLoading(false);
  }, [ready, user, activePatient, activePatientId]);

  // ==========================================
  // 邏輯：監聽目前長輩的提醒
  // ==========================================
  useEffect(() => {
    if (!ready || !user || !activePatientId) {
      setReminders([]);
      return;
    }

    const q = query(
      collection(db, "medication_reminders"),
      where("patientId", "==", activePatientId),
      where("enabled", "==", true)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Reminder[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            patientId: data.patientId ?? "",
            prescriptionId: data.prescriptionId ?? "",
            medicineName: data.medicineName ?? t.unknownMedicine,
            doseText: data.doseText ?? "",
            scheduleTime: data.scheduleTime ?? "",
            enabled: !!data.enabled,
            notifyUserIds: Array.isArray(data.notifyUserIds)
              ? data.notifyUserIds
              : [],
            lastSentDate: data.lastSentDate ?? "",
            createdAt: data.createdAt,
          };
        });

        rows.sort(
          (a, b) =>
            hhmmToMinutes(a.scheduleTime) - hhmmToMinutes(b.scheduleTime)
        );

        setReminders(rows);
      },
      (err) => {
        console.log("reminders snapshot error:", err);
        setReminders([]);
      }
    );

    return unsub;
  }, [ready, user, activePatientId, t.unknownMedicine]);

  // ==========================================
  // 邏輯：監聽今天已完成的服藥紀錄
  // ==========================================
  useEffect(() => {
    if (!ready || !user || !activePatientId) {
      setTodayLogs([]);
      return;
    }

    const q = query(
      collection(db, "medication_logs"),
      where("patientId", "==", activePatientId),
      where("dateKey", "==", todayKey)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: MedicationLog[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            reminderId: data.reminderId ?? "",
            patientId: data.patientId ?? "",
            dateKey: data.dateKey ?? "",
            scheduleTime: data.scheduleTime ?? "",
            reminderIds: Array.isArray(data.reminderIds) ? data.reminderIds : [],
          };
        });
        setTodayLogs(rows);
      },
      (err) => {
        console.log("medication logs snapshot error:", err);
        setTodayLogs([]);
      }
    );

    return unsub;
  }, [ready, user, activePatientId, todayKey]);

  const reminderSlots = useMemo(() => {
    const grouped = new Map<string, Reminder[]>();

    for (const reminder of reminders) {
      if (!reminder.scheduleTime || hhmmToMinutes(reminder.scheduleTime) === Number.MAX_SAFE_INTEGER) {
        continue;
      }

      const list = grouped.get(reminder.scheduleTime) ?? [];
      list.push(reminder);
      grouped.set(reminder.scheduleTime, list);
    }

    return Array.from(grouped.entries())
      .map(([scheduleTime, slotReminders]) => ({ scheduleTime, reminders: slotReminders }))
      .sort((a, b) => hhmmToMinutes(a.scheduleTime) - hhmmToMinutes(b.scheduleTime));
  }, [reminders]);

  const activeSlot = useMemo(() => {
    const now = clock.minutes;

    return (
      reminderSlots.find((slot) => {
        const scheduled = hhmmToMinutes(slot.scheduleTime);
        return (
          now >= scheduled - DONE_WINDOW_BEFORE_MINUTES &&
          now <= scheduled + DONE_WINDOW_AFTER_MINUTES
        );
      }) ?? null
    );
  }, [reminderSlots, clock.minutes]);

  const displaySlot = useMemo(() => {
    if (activeSlot) return activeSlot;
    if (!reminderSlots.length) return null;

    const upcoming = reminderSlots.find(
      (slot) => hhmmToMinutes(slot.scheduleTime) > clock.minutes
    );

    return upcoming ?? reminderSlots[0];
  }, [activeSlot, reminderSlots, clock.minutes]);

  const currentReminder = displaySlot?.reminders[0] ?? null;

  const activeSlotDone = useMemo(() => {
    if (!activeSlot) return false;

    const slotReminderIds = new Set(activeSlot.reminders.map((reminder) => reminder.id));

    return todayLogs.some((log) =>
      log.scheduleTime === activeSlot.scheduleTime ||
      slotReminderIds.has(log.reminderId) ||
      (Array.isArray(log.reminderIds) && log.reminderIds.some((id) => slotReminderIds.has(id)))
    );
  }, [activeSlot, todayLogs]);

  async function handleDonePress() {
    if (!user) {
      Alert.alert(t.cameraNotLoggedInTitle, t.resultNotLoggedIn);
      return;
    }

    if (!activePatientId) {
      Alert.alert(t.cameraNoPatientTitle, t.resultNoPatient);
      return;
    }

    if (!currentReminder || !activeSlot) {
      Alert.alert(t.noReminder, "目前尚未進入餵藥時間，請在預定時間前 30 分鐘至後 60 分鐘內操作。 ");
      return;
    }

    if (activeSlotDone) {
      Alert.alert(t.alreadyDone, t.reminderAlreadyDone);
      return;
    }

    try {
      setDoneLoading(true);

      const slotReminders = activeSlot.reminders;
      const primaryReminder = slotReminders[0];
      const logId = medicationLogId(
        activePatientId,
        activePatient?.patientsId,
        todayKey,
        activeSlot.scheduleTime
      );
      const logRef = doc(
        db,
        "medication_logs",
        logId
      );

      // Do not read the deterministic log document before creating it.
      // Firestore rules intentionally deny reads for a non-existent medication log,
      // so a transaction.get() here turns a valid first-time DONE into permission-denied.
      await setDoc(logRef, {
        logId,
        reminderId: primaryReminder.id,
        reminderIds: slotReminders.map((reminder) => reminder.id),
        prescriptionId: primaryReminder.prescriptionId ?? "",
        prescriptionIds: [
          ...new Set(
            slotReminders
              .map((reminder) => reminder.prescriptionId ?? "")
              .filter(Boolean)
          ),
        ],
        patientId: activePatientId,
        patientsId: activePatient?.patientsId ?? "",
        medicineName: primaryReminder.medicineName,
        medicineNames: slotReminders.map((reminder) => reminder.medicineName),
        doseText: primaryReminder.doseText,
        scheduleTime: activeSlot.scheduleTime,
        status: "taken",
        confirmedBy: user.uid,
        takenAt: serverTimestamp(),
        dateKey: todayKey,
        createdAt: serverTimestamp(),
      });

      Alert.alert(t.alreadyDone, t.doneRecorded);
    } catch (error) {
      console.log("done error:", error);
      Alert.alert(t.resultErrorTitle, t.recordFailed);
    } finally {
      setDoneLoading(false);
    }
  }

  const isFullyLoaded = !loading && ready;
  useEffect(() => {
    if (isFullyLoaded) {
      hasLoadedOnceRef.current = true;
    }
  });

  if (!hasLoadedOnceRef.current && !isFullyLoaded) {
    return <ActivityIndicator style={{ flex: 1, justifyContent: "center" }} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 使用者姓名 (移除了原本的 Header) */}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{target?.name ?? t.noSelectedPatient}</Text>
        </View>

        {/* 用藥提醒卡片 */}
        <View style={styles.reminderCard}>
          <View style={styles.reminderTitleRow}>
            <Ionicons name="alarm" size={32} color="#4F59D5" />
            <Text style={styles.reminderTitle}>
              {currentReminder
                ? `${currentReminder.scheduleTime} ${t.reminder}`
                : t.noReminder}
            </Text>
          </View>

          <View style={styles.reminderSubRow}>
            <Ionicons name="medkit" size={24} color="#2563EB" />
            <Text style={styles.reminderSubText}>
              {currentReminder
                ? `${currentReminder.medicineName} (${currentReminder.doseText || t.doseAsDirected})`
                : t.buildReminderByScan}
            </Text>
          </View>

          <Pressable
            style={[
              styles.doneBtn,
              doneLoading
                ? styles.doneBtnLoading
                : activeSlotDone
                ? styles.doneBtnDone
                : activeSlot
                ? styles.doneBtnActive
                : styles.doneBtnDisabled,
            ]}
            onPress={handleDonePress}
            disabled={!activeSlot || activeSlotDone || doneLoading}
          >
            {doneLoading ? (
              <Text style={styles.doneBtnTextMuted}>...</Text>
            ) : activeSlotDone ? (
              <View style={styles.doneBtnRow}>
                <Text style={styles.doneBtnTextLight}>DONE</Text>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              </View>
            ) : activeSlot ? (
              <Text style={styles.doneBtnTextLight}>DONE</Text>
            ) : (
              <Text style={styles.doneBtnTextMuted}>DONE</Text>
            )}
          </Pressable>
        </View>

        {/* 功能選單標題 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t.functionMenu}</Text>
        </View>

        {/* 掃描藥單 */}
        <Pressable
          onPress={() => router.push("/caregiver/camera")}
          style={styles.mainActionButton}
        >
          <Ionicons name="camera" size={24} color="#FFF" />
          <Text style={styles.mainActionText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{t.scanPrescription}</Text>
        </Pressable>

        {/* 2x2 功能網格 */}
        <View style={styles.gridContainer}>
          <View style={styles.gridRow}>
            <Pressable
              onPress={() => router.push("/caregiver/list")}
              style={[styles.gridItem, { backgroundColor: "#FEF9C3" }]}
            >
              <View style={styles.gridGroup}>
                <View style={[styles.gridIconBadge, { backgroundColor: "#CA8A04" }]}>
                  <Ionicons name="clipboard" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.gridText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>{t.viewPrescriptionRecords}</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => router.push("/caregiver/health-report" as any)}
              style={[styles.gridItem, { backgroundColor: "#FFEDD5" }]}
            >
              <View style={styles.gridGroup}>
                <View style={[styles.gridIconBadge, { backgroundColor: "#EA580C" }]}>
                  <Ionicons name="pulse" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.gridText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>{t.dailyHealthReport}</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.gridRow}>
            <Pressable
              onPress={() =>
                router.push("/caregiver/communication-cards" as any)
              }
              style={[styles.gridItem, { backgroundColor: "#DCFCE7" }]}
            >
              <View style={styles.gridGroup}>
                <View style={[styles.gridIconBadge, { backgroundColor: "#16A34A" }]}>
                  <Ionicons name="image" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.gridText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>{t.communicationCards}</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => router.push("/caregiver/video-record" as any)}
              style={[styles.gridItem, { backgroundColor: "#DBEAFE" }]}
            >
              <View style={styles.gridGroup}>
                <View style={[styles.gridIconBadge, { backgroundColor: "#2563EB" }]}>
                  <Ionicons name="videocam" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.gridText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>{t.conditionRecording}</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ==========================================
// 樣式表
// ==========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingBottom: 190, // 避開懸浮的緊急撥號鍵與底部導覽列（兩者皆為浮動疊層，不會自動讓出空間）
    paddingTop: 80, // 稍微加大上方的 Padding，閃開共用導覽列的漢堡按鈕
  },
  userInfo: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  userName: {
    fontSize: 38,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#111827",
  },
  reminderCard: {
    backgroundColor: "#F8F9FC",
    marginHorizontal: 20,
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  reminderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
    width: "100%",
    justifyContent: "center",
  },
  emojiLarge: {
    fontSize: 36,
  },
  reminderTitle: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#000",
    letterSpacing: 0.4,
    textAlign: "center",
    flexShrink: 1,
  },
  reminderSubRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
    width: "100%",
    justifyContent: "center",
  },
  emojiMedium: {
    fontSize: 28,
  },
  reminderSubText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    textAlign: "center",
    flexShrink: 1,
  },
  doneBtn: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  doneBtnActive: { backgroundColor: "#F5A623" },
  doneBtnDone: { backgroundColor: "#22C55E" },
  doneBtnDisabled: { backgroundColor: "#E5E7EB" },
  doneBtnLoading: { backgroundColor: "#E5E7EB" },
  doneBtnTextLight: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#FFFFFF",
  },
  doneBtnTextMuted: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#9CA3AF",
  },
  doneBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sectionHeader: {
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  mainActionButton: {
    backgroundColor: "#4F59D5",
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  mainActionText: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFF",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  gridContainer: {
    marginHorizontal: 20,
    gap: 16,
  },
  gridRow: {
    flexDirection: "row",
    gap: 16,
  },
  gridItem: {
    flex: 1,
    height: 128,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  gridGroup: {
    width: "100%",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  gridIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  gridText: {
    width: "100%",
    paddingHorizontal: 2,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "bold",
    color: "#111827",
    letterSpacing: 0.2,
    textAlign: "center",
  },
});
