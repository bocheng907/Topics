// app/family/index.tsx
import { db } from "@/firebase/firebaseConfig";
import { invitationCopy } from "@/src/care-target/invitationCopy";
import { router } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { getHomeLayout } from "@/src/ui/homeLayout";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type DimensionValue } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader, Button, Card, EmptyState, VitalCard, type IconName, type VitalStatus } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { Ionicons } from "@expo/vector-icons";

import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { useHealthThresholds } from "@/src/health/useHealthThresholds";
import { translations } from "@/src/i18n/translations";
import { familyCopy, relativeTimeLabel } from "@/src/i18n/copy/familyCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { useMedicationProgress } from "@/src/reminders/useMedicationProgress";
import { progressCopy } from "@/src/reminders/medicationProgress";
import { joinNavigationCopy } from "@/src/care-target/joinNavigationCopy";

// 生理數據狀態型別（VitalStatus）來自共用的 VitalCard
type SingleVital = { val: number; ts: number } | null;
type BloodPressureVital = { sys: number; dia: number; ts: number } | null;
type SugarVital = { val: number; type: string; ts: number } | null;
type VitalType = 'temp' | 'hr' | 'bp' | 'sugar';

// 狀態外觀（正常安靜、異常醒目、未更新／無資料灰階）由共用 VitalCard 負責

export default function FamilyHomeScreen() {
  const { width, fontScale } = useWindowDimensions();
  const { vitalWidth, stackedActions } = getHomeLayout(width, fontScale);
  const { ready, activePatient, activePatientId, linkedCareTargets, setActivePatientId } = useActiveCareTarget();
  const { language } = useLanguage();
  const t = translations[language];
  const fc = familyCopy[language];
  const stats = useMedicationProgress(activePatientId);
  const medicationCopy = progressCopy[language];
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // 🌟 抓取該長輩的健康閾值設定
  const { thresholds: dbThresholds, loading: thresholdsLoading } = useHealthThresholds(
    activePatientId ?? "",
    activePatient?.patientsId
  );

  // 存放最新的生理數據
  const [vitals, setVitals] = useState<any>({
    temp: null,
    hr: null,
    bp: null,
    sugar: null,
    hasAnyData: false
  });

  // ==========================================
  // 邏輯：監聽健康紀錄，抓出最新數值
  // ==========================================
  useEffect(() => {
    if (!ready || !activePatientId) return;

    const q = query(
      collection(db, "health_records"),
      where("patientId", "==", activePatientId)
    );

    const unsub = onSnapshot(q, (snap) => {
      let temp: SingleVital = null;
      let hr: SingleVital = null;
      let bp: BloodPressureVital = null;
      let sugar: SugarVital = null;
      let hasAnyData = false;

      const newestDocs = [...snap.docs]
        .sort((a, b) => (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0))
        .slice(0, 10);
      newestDocs.forEach(doc => {
        const d = doc.data();
        const ts = d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now();
        hasAnyData = true;

        // 如果還沒找到該項目的最新值，且這份文件有該數值，就填入
        if (!temp && d.temperature !== undefined) temp = { val: d.temperature, ts };
        if (!hr && d.heartRate !== undefined) hr = { val: d.heartRate, ts };
        if (!bp && d.bloodPressureSys !== undefined && d.bloodPressureDia !== undefined) {
          bp = { sys: d.bloodPressureSys, dia: d.bloodPressureDia, ts };
        }
        if (!sugar && d.bloodSugar !== undefined) sugar = { val: d.bloodSugar, type: d.bloodSugarType || t.fasting, ts };
      });

      setVitals({ temp, hr, bp, sugar, hasAnyData });
    });

    return unsub;
  }, [ready, activePatientId, t.fasting]);

  const copyInviteCode = async () => {
    router.push("/care-target/invitations" as any);
  };

  const isFullyLoaded = ready && linkedCareTargets.length > 0 && !thresholdsLoading;
  if (isFullyLoaded && !hasLoadedOnce) setHasLoadedOnce(true);

  if (ready && linkedCareTargets.length === 0) {
    const copy = joinNavigationCopy[language];
    return (
      <View style={styles.container}>
        <AppHeader title={t.navHome} left="menu" />
        <SafeAreaView style={styles.body} edges={["left", "right"]}>
          <ScrollView contentContainerStyle={styles.emptyScroll}>
            <EmptyState icon="people-outline" title={copy.empty} body={copy.hint} />
            <Button label={t.createCareTarget} icon="add" size="lg" fullWidth onPress={() => router.push("/care-target/create")} />
            <Button label={t.joinCareTarget} icon="enter-outline" size="lg" variant="secondary" fullWidth onPress={() => router.push("/care-target/join")} />
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  if (!ready || (!hasLoadedOnce && !isFullyLoaded)) {
    return (
      <View style={styles.container}>
        <AppHeader title={t.navHome} left="menu" />
        <ActivityIndicator style={{ flex: 1, justifyContent: "center" }} color={colors.primary} />
      </View>
    );
  }


  // ==========================================
  // 🌟 升級版 UI 輔助函式：判斷醫學數值正常與否 (結合自訂閾值，並修正預設值對齊)
  // ==========================================
  const checkVitalStatus = (type: string, data: any): VitalStatus => {
    if (!data) return 'nodata';

    const isOutdated = (now - data.ts) > 24 * 60 * 60 * 1000;
    if (isOutdated) return 'outdated';

    if (type === 'temp') {
      const min = dbThresholds?.temperature?.enabled ? Number(dbThresholds.temperature.min) : 36.0;
      const max = dbThresholds?.temperature?.enabled ? Number(dbThresholds.temperature.max) : 37.5;
      if (data.val < min || data.val > max) return 'abnormal';

    } else if (type === 'hr') {
      const min = dbThresholds?.heartRate?.enabled ? Number(dbThresholds.heartRate.min) : 60;
      const max = dbThresholds?.heartRate?.enabled ? Number(dbThresholds.heartRate.max) : 100;
      if (data.val < min || data.val > max) return 'abnormal';

    } else if (type === 'bp') {
      const sysMin = dbThresholds?.systolic?.enabled ? Number(dbThresholds.systolic.min) : 90;
      const sysMax = dbThresholds?.systolic?.enabled ? Number(dbThresholds.systolic.max) : 140;
      const diaMin = dbThresholds?.diastolic?.enabled ? Number(dbThresholds.diastolic.min) : 60;
      const diaMax = dbThresholds?.diastolic?.enabled ? Number(dbThresholds.diastolic.max) : 90;
      if (data.sys < sysMin || data.sys > sysMax || data.dia < diaMin || data.dia > diaMax) return 'abnormal';

    } else if (type === 'sugar') {
      if (data.type === '空腹' || data.type === '飯前' || data.type === t.fasting) {
        const min = dbThresholds?.bloodSugar?.enabled ? Number(dbThresholds.bloodSugar.beforeMin) : 70;
        const max = dbThresholds?.bloodSugar?.enabled ? Number(dbThresholds.bloodSugar.beforeMax) : 130;
        if (data.val < min || data.val > max) return 'abnormal';
      } else {
        const min = dbThresholds?.bloodSugar?.enabled ? Number(dbThresholds.bloodSugar.afterMin) : 70;
        const max = dbThresholds?.bloodSugar?.enabled ? Number(dbThresholds.bloodSugar.afterMax) : 180;
        if (data.val < min || data.val > max) return 'abnormal';
      }
    }
    return 'normal';
  };

  const statusLabel: Record<VitalStatus, string> = {
    normal: fc.statusNormal,
    abnormal: fc.statusAbnormal,
    outdated: fc.statusOutdated,
    nodata: fc.statusNoData,
  };

  const vitalItems: { title: string; type: VitalType; data: any }[] = [
    { title: t.temperature, type: 'temp', data: vitals.temp },
    { title: t.heartRate, type: 'hr', data: vitals.hr },
    { title: t.bloodPressure, type: 'bp', data: vitals.bp },
    { title: t.bloodSugar, type: 'sugar', data: vitals.sugar },
  ];
  const vitalStatuses = vitalItems.map(item => checkVitalStatus(item.type, item.data));
  const abnormalCount = vitalStatuses.filter(status => status === 'abnormal').length;

  const renderVitalBlock = (item: { title: string; type: VitalType; data: any }, status: VitalStatus) => {
    const { title, type, data } = item;
    const value = !data ? '--' : type === 'bp' ? `${data.sys}/${data.dia}` : String(data.val);
    const unit = type === 'temp' ? '°C' : type === 'hr' ? 'bpm' : type === 'bp' ? 'mmHg' : 'mg/dL';
    const unitLine = data && type === 'sugar' && data.type ? `${unit} · ${data.type}` : unit;
    const timeLabel = data?.ts ? relativeTimeLabel(fc, data.ts, now) : null;

    return (
      <VitalCard
        key={type}
        variant="compact"
        title={title}
        status={status}
        statusLabel={statusLabel[status]}
        values={[{ value }]}
        meta={`${unitLine}${timeLabel ? ` · ${timeLabel}` : ''}`}
        accessibilityLabel={`${title}, ${statusLabel[status]}, ${value} ${unitLine}${timeLabel ? `, ${timeLabel}` : ''}`}
        style={{ width: vitalWidth }}
      />
    );
  };

  const hasMedicationProgress = !stats.error && !stats.loading && stats.total > 0;
  const progressRatio = hasMedicationProgress ? Math.min(1, stats.completed / stats.total) : 0;

  const quickActions: { key: string; icon: IconName; label: string; onPress: () => void }[] = [
    { key: 'list', icon: 'clipboard-outline', label: t.prescriptionRecords, onPress: () => router.push("/family/list") },
    { key: 'condition', icon: 'videocam-outline', label: t.conditionView, onPress: () => router.push("/family/condition" as any) },
    { key: 'voice', icon: 'mic-outline', label: t.recordVoice, onPress: () => router.push("/family/voice") },
  ];

  return (
    <View style={styles.container}>
      <AppHeader title={t.navHome} left="menu" />
      <SafeAreaView style={styles.body} edges={["left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* 照護對象切換 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.avatarList}
          accessibilityLabel={fc.careTargets}
        >
          {linkedCareTargets.map((target) => {
            const isActive = target.id === activePatientId;
            return (
              <Pressable
                key={target.id}
                accessibilityRole="button"
                accessibilityLabel={fc.switchCareTarget(target.name || "?")}
                accessibilityState={{ selected: isActive }}
                onPress={async () => {
                  try { await setActivePatientId(target.id); }
                  catch { Alert.alert(t.prompt, invitationCopy[language].error); }
                }}
                style={({ pressed }) => pressed && { opacity: 0.8 }}
              >
                <View style={[styles.avatar, isActive ? styles.avatarActive : styles.avatarInactive]}>
                  <Text style={[styles.avatarText, isActive ? styles.avatarTextActive : styles.avatarTextInactive]}>
                    {target.name ? target.name.charAt(0) : "?"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={fc.addCareTarget}
            onPress={() => router.push("/care-target/create")}
            style={({ pressed }) => [styles.avatar, styles.avatarAdd, pressed && { backgroundColor: colors.primarySoft }]}
          >
            <Ionicons name="add" size={24} color={colors.primary} />
          </Pressable>
        </ScrollView>

        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={2}>{activePatient?.name ?? t.noSelectedPatient}</Text>
          <Pressable
            onPress={copyInviteCode}
            accessibilityRole="button"
            accessibilityLabel={invitationCopy[language].title}
            style={({ pressed }) => [styles.inviteBadge, pressed && { backgroundColor: colors.primarySoft }]}
          >
            <Ionicons name="person-add-outline" size={16} color={colors.primary} />
            <Text style={styles.inviteText} numberOfLines={1}>{invitationCopy[language].title}</Text>
          </Pressable>
        </View>

        {/* 今日用藥進度 */}
        <Card style={styles.section}>
          <View style={styles.medHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="medkit-outline" size={22} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>{t.todayMedicationProgress}</Text>
          </View>
          {stats.error ? (
            <Text style={styles.medError}>{medicationCopy.error}</Text>
          ) : stats.loading ? (
            <Text style={styles.medDetail}>{t.loading}</Text>
          ) : stats.total > 0 ? (
            <>
              <View style={styles.medProgressRow}>
                <Text style={styles.medUnit}>{t.completed} </Text>
                <Text style={styles.medProgress}>{stats.completed}</Text>
                <Text style={styles.medTotal}> / {stats.total} </Text>
                <Text style={styles.medUnit}>{medicationCopy.unit}</Text>
              </View>
              <View
                style={styles.progressTrack}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: stats.total, now: stats.completed }}
              >
                <View style={[styles.progressFill, { width: `${Math.round(progressRatio * 100)}%` as DimensionValue }]} />
              </View>
            </>
          ) : stats.prescriptionCount > 0 ? (
            <Text style={styles.medDetail}>{medicationCopy.none}</Text>
          ) : (
            <>
              <Text style={styles.medEmptyTitle}>{t.noPrescriptions}</Text>
              <Text style={styles.medDetail}>{invitationCopy[language].primaryOnly}</Text>
            </>
          )}
        </Card>

        {/* 健康數據 */}
        <Card style={styles.section}>
          <Text style={[styles.cardTitle, styles.vitalsHeading]} accessibilityRole="header">{fc.vitalsTitle}</Text>
          {!vitals.hasAnyData ? (
            <EmptyState icon="pulse-outline" title={t.noVitals} body={t.vitalsWillShow} style={styles.vitalsEmpty} />
          ) : (
            <>
              {abnormalCount > 0 ? (
                <View style={styles.alertStrip} accessibilityRole="alert">
                  <Ionicons name="warning" size={20} color={colors.danger} />
                  <Text style={styles.alertText}>{fc.abnormalAlert(abnormalCount)}</Text>
                </View>
              ) : null}
              <View style={styles.vitalsGrid}>
                {vitalItems.map((item, index) => renderVitalBlock(item, vitalStatuses[index]))}
              </View>
            </>
          )}
          <Button
            label={t.viewChart}
            icon="bar-chart-outline"
            variant="secondary"
            fullWidth
            onPress={() => router.push("/family/dashboard" as any)}
            style={styles.chartBtn}
          />
        </Card>

        {/* 常用功能 */}
        <Text style={styles.sectionLabel} accessibilityRole="header">{fc.quickActions}</Text>
        <View style={[styles.actionsRow, stackedActions && styles.actionsColumn]}>
          {quickActions.map(action => (
            <Pressable
              key={action.key}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              style={({ pressed }) => [
                styles.actionBtn,
                stackedActions && styles.actionBtnStacked,
                pressed && styles.actionBtnPressed,
              ]}
            >
              <View style={styles.actionIconBadge}>
                <Ionicons name={action.icon} size={26} color={colors.primary} />
              </View>
              <Text style={[styles.actionText, stackedActions && styles.actionTextStacked]} numberOfLines={2}>
                {action.label}
              </Text>
              {stackedActions ? <Ionicons name="chevron-forward" size={20} color={colors.textMuted} /> : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  body: { flex: 1 },
  scrollContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  emptyScroll: { padding: spacing.xl, gap: spacing.md },

  avatarList: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: layout.screenPaddingX },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  avatarActive: { backgroundColor: colors.primary },
  avatarInactive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  avatarText: { fontSize: 20, fontWeight: "700" },
  avatarTextActive: { color: colors.onPrimary },
  avatarTextInactive: { color: colors.textSecondary },
  avatarAdd: { backgroundColor: colors.surface, borderWidth: 1, borderStyle: "dashed", borderColor: colors.primaryBorder },

  userInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: layout.screenPaddingX,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  userName: { ...typography.display, flexShrink: 1, maxWidth: "100%" },
  inviteBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.surface,
  },
  inviteText: { ...typography.label, color: colors.primary, flexShrink: 1 },

  section: { marginHorizontal: layout.screenPaddingX, marginBottom: spacing.lg },
  cardTitle: { ...typography.header, flexShrink: 1 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },

  medHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  medProgressRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" },
  medProgress: { fontSize: 32, lineHeight: 40, fontWeight: "700", color: colors.text },
  medTotal: { fontSize: 22, lineHeight: 30, fontWeight: "600", color: colors.textSecondary },
  medUnit: { ...typography.bodySmall },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceSunken, marginTop: spacing.md, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: colors.primary },
  medDetail: { ...typography.body, color: colors.textSecondary },
  medEmptyTitle: { ...typography.bodyStrong, marginBottom: spacing.xs },
  medError: { ...typography.body, color: colors.danger },

  vitalsHeading: { marginBottom: spacing.md },
  vitalsEmpty: { paddingVertical: spacing.lg },
  alertStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  alertText: { ...typography.bodyStrong, color: colors.danger, flex: 1 },
  vitalsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.md },


  chartBtn: { marginTop: spacing.lg },

  sectionLabel: { ...typography.overline, paddingHorizontal: layout.screenPaddingX + spacing.xs, marginBottom: spacing.sm },
  actionsRow: { flexDirection: "row", gap: spacing.md, marginHorizontal: layout.screenPaddingX },
  actionsColumn: { flexDirection: "column", gap: spacing.sm },
  actionBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 120,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    gap: spacing.sm,
  },
  actionBtnStacked: { flex: 0, minHeight: 64, flexDirection: "row", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  actionBtnPressed: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
  actionIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: { ...typography.bodyStrong, width: "100%", textAlign: "center" },
  actionTextStacked: { flex: 1, width: undefined, textAlign: "left" },
});
