// app/caregiver/index.tsx
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { getHomeLayout } from "@/src/ui/homeLayout";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader, Button, Card, SectionHeader, type IconName } from "@/src/ui/components";
import { colors, layout, spacing, typography } from "@/src/ui/theme";
import { caregiverCopy } from "@/src/i18n/copy/caregiverCopy";
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
  useWindowDimensions,
  ActivityIndicator,
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
import { useScreenBottomInset } from "@/src/ui/BottomInsetContext";

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
  const bottomInset = useScreenBottomInset();
  const { width, fontScale } = useWindowDimensions();
  const { narrowCards } = getHomeLayout(width, fontScale);
  const { user } = useAuth();
  const { activePatient, activePatientId, ready } = useActiveCareTarget();
  const { language } = useLanguage();
  const t = translations[language];
  const c = caregiverCopy[language];
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const target = ready && user && activePatientId ? activePatient as CareTarget | null : null;
  const loading = !ready;

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [todayLogs, setTodayLogs] = useState<MedicationLog[]>([]);
  const [doneLoading, setDoneLoading] = useState(false);
  const doneSubmissionRef = useRef({ pending: false, completedId: "" });
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

    const timer = setInterval(refreshClock, 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  // ==========================================
  // 邏輯：防呆與權限檢查 (沒有長輩則去加入)
  // ==========================================
  const dataScope = `${ready}/${user?.uid}/${activePatientId}/${todayKey}`;
  const [previousScope, setPreviousScope] = useState(dataScope);
  if (previousScope !== dataScope) {
    setPreviousScope(dataScope); setReminders([]); setTodayLogs([]);
  }

  // ==========================================
  // 邏輯：監聽目前長輩的提醒
  // ==========================================
  useEffect(() => {
    if (!ready || !user || !activePatientId) {
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
    // React's disabled state updates after this event; block another tap immediately.
    if (doneSubmissionRef.current.pending) return;

    if (!user) {
      Alert.alert(t.cameraNotLoggedInTitle, t.resultNotLoggedIn);
      return;
    }

    if (!activePatientId) {
      Alert.alert(t.cameraNoPatientTitle, t.resultNoPatient);
      return;
    }

    if (!currentReminder || !activeSlot) {
      Alert.alert(t.noReminder, c.homeDoneWindowAlert);
      return;
    }

    if (activeSlotDone) {
      Alert.alert(t.alreadyDone, t.reminderAlreadyDone);
      return;
    }

    const logId = medicationLogId(
      activePatientId,
      activePatient?.patientsId,
      todayKey,
      activeSlot.scheduleTime
    );
    // Cover the gap between a successful write and the snapshot updating the button.
    if (doneSubmissionRef.current.completedId === logId) return;
    doneSubmissionRef.current.pending = true;

    try {
      setDoneLoading(true);

      const slotReminders = activeSlot.reminders;
      const primaryReminder = slotReminders[0];
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

      doneSubmissionRef.current.completedId = logId;
      Alert.alert(t.alreadyDone, t.doneRecorded);
    } catch (error) {
      console.log("done error:", error);
      Alert.alert(t.resultErrorTitle, t.recordFailed);
    } finally {
      doneSubmissionRef.current.pending = false;
      setDoneLoading(false);
    }
  }

  const isFullyLoaded = !loading && ready;
  if (isFullyLoaded && !hasLoadedOnce) {
    setHasLoadedOnce(true);
  }

  if (!hasLoadedOnce && !isFullyLoaded) {
    return (
      <View style={styles.container}>
        <AppHeader title={t.navHome} left="menu" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!activePatientId || !activePatient) {
    return (
      <View style={styles.container}>
        <AppHeader title={t.navHome} left="menu" />
        <ScrollView contentContainerStyle={[styles.noTargetContainer, { paddingBottom: spacing.xl + bottomInset }]}>
          <Card style={styles.noTargetCard}>
            <View style={styles.noTargetIcon}>
              <Ionicons name="person-add-outline" size={36} color={colors.primary} />
            </View>
            <Text style={styles.noTargetTitle}>{c.homeNoTargetTitle}</Text>
            <Text style={styles.noTargetDescription}>{c.homeNoTargetBody}</Text>
            <Button
              label={c.homeBindTarget}
              icon="people-outline"
              size="lg"
              fullWidth
              onPress={() => router.push("/care-target/join" as any)}
            />
            <Button
              label={c.homeBindAgency}
              icon="business-outline"
              size="lg"
              variant="secondary"
              fullWidth
              onPress={() => router.push("/caregiver/agency-binding" as any)}
            />
          </Card>
        </ScrollView>
      </View>
    );
  }

  const doneDisabled = !activeSlot || activeSlotDone || doneLoading;

  return (
    <View style={styles.container}>
      <AppHeader title={t.navHome} left="menu" />
      <SafeAreaView style={styles.body} edges={["left", "right"]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xxxl + bottomInset }]}>
          <View style={styles.userInfo}>
            <Text style={styles.overline}>{c.homeCaringFor}</Text>
            <Text style={styles.userName} numberOfLines={2}>
              {target?.name ?? t.noSelectedPatient}
            </Text>
          </View>

          {/* 用藥提醒卡片 */}
          <Card style={styles.reminderCard}>
            <View style={styles.reminderTitleRow}>
              <Ionicons name="alarm-outline" size={28} color={colors.primary} />
              <Text style={styles.reminderTitle}>
                {currentReminder ? `${currentReminder.scheduleTime} ${t.reminder}` : t.noReminder}
              </Text>
            </View>

            <View style={styles.reminderSubRow}>
              <Ionicons name="medkit-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.reminderSubText}>
                {currentReminder
                  ? `${currentReminder.medicineName} (${currentReminder.doseText || t.doseAsDirected})`
                  : t.buildReminderByScan}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.doneBtn,
                doneLoading || (!activeSlot && !activeSlotDone)
                  ? styles.doneBtnDisabled
                  : activeSlotDone
                  ? styles.doneBtnDone
                  : pressed
                  ? styles.doneBtnPressed
                  : styles.doneBtnActive,
              ]}
              onPress={handleDonePress}
              disabled={doneDisabled}
              accessibilityRole="button"
              accessibilityLabel={c.homeDone}
              accessibilityState={{ disabled: doneDisabled, busy: doneLoading, checked: activeSlotDone }}
            >
              {doneLoading ? (
                <ActivityIndicator size="large" color={colors.textMuted} />
              ) : activeSlotDone ? (
                <>
                  <Ionicons name="checkmark-circle" size={36} color={colors.onPrimary} />
                  <Text style={styles.doneBtnTextLight}>{c.homeDone}</Text>
                </>
              ) : (
                <Text style={activeSlot ? styles.doneBtnTextLight : styles.doneBtnTextMuted}>{c.homeDone}</Text>
              )}
            </Pressable>
            {!activeSlot && currentReminder ? <Text style={styles.doneHint}>{c.homeDoneWindowHint}</Text> : null}
          </Card>

          <SectionHeader title={t.functionMenu} style={styles.sectionHeader} />

          {/* 掃描藥單：最主要的操作 */}
          <Button
            label={t.scanPrescription}
            icon="camera"
            size="lg"
            fullWidth
            onPress={() => router.push("/caregiver/camera")}
            style={styles.mainActionButton}
          />

          {/* 2x2 功能網格 */}
          <View style={styles.gridContainer}>
            <View style={[styles.gridRow, narrowCards && { flexDirection: "column" }]}>
              <HomeTile icon="clipboard-outline" label={t.viewPrescriptionRecords} onPress={() => router.push("/caregiver/list")} />
              <HomeTile icon="pulse-outline" label={t.dailyHealthReport} onPress={() => router.push("/caregiver/health-report" as any)} />
            </View>
            <View style={[styles.gridRow, narrowCards && { flexDirection: "column" }]}>
              <HomeTile icon="images-outline" label={t.communicationCards} onPress={() => router.push("/caregiver/communication-cards" as any)} />
              <HomeTile icon="videocam-outline" label={t.conditionRecording} onPress={() => router.push("/caregiver/video-record" as any)} />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function HomeTile({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={label} style={styles.gridItem}>
      <View style={styles.gridIconBadge}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={styles.gridText}>{label}</Text>
    </Card>
  );
}

// ==========================================
// 樣式表
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  body: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: layout.screenPaddingX,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },

  noTargetContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  noTargetCard: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  noTargetIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  noTargetTitle: { ...typography.title, textAlign: "center" },
  noTargetDescription: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.md },

  userInfo: { paddingHorizontal: spacing.xs, marginBottom: spacing.lg },
  overline: { ...typography.overline },
  userName: { ...typography.display, fontSize: 32, lineHeight: 40, marginTop: 2 },

  reminderCard: { alignItems: "center", paddingVertical: spacing.xl, paddingHorizontal: spacing.xl },
  reminderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    width: "100%",
    justifyContent: "center",
  },
  reminderTitle: { ...typography.display, flexShrink: 1, textAlign: "center" },
  reminderSubRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.xl,
    width: "100%",
    justifyContent: "center",
  },
  reminderSubText: { ...typography.header, color: colors.textSecondary, flexShrink: 1, textAlign: "center" },
  doneBtn: {
    width: 128,
    height: 128,
    borderRadius: 64,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.md,
  },
  doneBtnActive: { backgroundColor: colors.primary },
  doneBtnPressed: { backgroundColor: colors.primaryPressed },
  doneBtnDone: { backgroundColor: colors.success },
  doneBtnDisabled: { backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border },
  doneBtnTextLight: { fontSize: 22, lineHeight: 28, fontWeight: "700", color: colors.onPrimary, textAlign: "center" },
  doneBtnTextMuted: { fontSize: 22, lineHeight: 28, fontWeight: "700", color: colors.textDisabled, textAlign: "center" },
  doneHint: { ...typography.bodySmall, textAlign: "center", marginTop: spacing.md },

  sectionHeader: { paddingTop: spacing.xxl },
  mainActionButton: { marginBottom: spacing.md },
  gridContainer: { gap: spacing.md },
  gridRow: { flexDirection: "row", gap: spacing.md },
  gridItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 128,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  gridIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  gridText: { ...typography.bodyStrong, textAlign: "center", width: "100%" },
});
