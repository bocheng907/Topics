// app/family/dashboard.tsx
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { AppHeader, Button, Card, Chip, KeyboardAwareScroll, SegmentedTabs, VitalCard } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { familyCopy, relativeTimeLabel } from "@/src/i18n/copy/familyCopy";
import { Ionicons } from "@expo/vector-icons";
import { db } from "@/firebase/firebaseConfig";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import HealthTrendChart from "@/src/health/HealthTrendChart";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import {
  ChartDataType,
  ChartTimeRange,
  useHealthChartData,
} from "@/src/health/useHealthChartData";
import { PatientThresholds, useHealthThresholds } from "@/src/health/useHealthThresholds";
import { usePrimaryFamily } from "@/src/care-target/usePrimaryFamily";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";

type VitalStatus = "normal" | "abnormal" | "outdated" | "nodata";
type SingleVital = { val: number; ts: number; } | null;
type BloodPressureVital = { sys: number; dia: number; ts: number; } | null;
type VitalsState = {
  temp: SingleVital;
  hr: SingleVital;
  bp: BloodPressureVital;
  sugarFasting: SingleVital;
  sugarAfter: SingleVital;
  hasAnyData: boolean;
};

// ─────────────────────────────────────────
// 醫學 critical 邊界（前端防呆用）
// ─────────────────────────────────────────
const CRITICAL_BOUNDS = {
  temperature: { minSafe: 35.0, maxSafe: 39.0 },
  heartRate:   { minSafe: 40,   maxSafe: 150  },
  systolic:    { minSafe: 80,   maxSafe: 160  },
  diastolic:   { minSafe: 50,   maxSafe: 100  },
  bloodSugarBefore: { minSafe: 60, maxSafe: 200 },
  bloodSugarAfter:  { minSafe: 60, maxSafe: 250 },
};

export default function FamilyDashboardScreen() {
  const { ready, activePatient, activePatientId } = useActiveCareTarget();
  const { language } = useLanguage();
  const t = translations[language];
  const fc = familyCopy[language];
  const isPrimaryFamily = usePrimaryFamily(activePatientId);

  const [activeTab, setActiveTab] = useState<"history" | "today" | "settings">("today");
  const [chartDataType, setChartDataType] = useState<ChartDataType>("體溫");
  const [chartTimeRange, setChartTimeRange] = useState<ChartTimeRange>("1周");

  const dataTypes: ChartDataType[] = ["體溫", "心跳", "血壓", "血糖"];
  const timeRanges: ChartTimeRange[] = ["1周", "2周", "1個月", "全部"];

  const { loading, empty, lineData, bpSysData, bpDiaData } = useHealthChartData({
    patientId: activePatientId ?? undefined,
    chartDataType,
    chartTimeRange,
  });

  const { thresholds: dbThresholds, loading: thresholdsLoading, saveThresholds } = useHealthThresholds(
    activePatientId ?? "",
    activePatient?.patientsId,
    isPrimaryFamily
  );
  const [localThresholds, setLocalThresholds] = useState<PatientThresholds>(dbThresholds);

  const [previousThresholds, setPreviousThresholds] = useState(dbThresholds);
  if (!thresholdsLoading && previousThresholds !== dbThresholds) {
    setPreviousThresholds(dbThresholds);
    setLocalThresholds(dbThresholds);
  }
  if (!isPrimaryFamily && activeTab === "settings") setActiveTab("today");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const [vitals, setVitals] = useState<VitalsState>({
    temp: null, hr: null, bp: null, sugarFasting: null, sugarAfter: null, hasAnyData: false,
  });

  useEffect(() => {
    if (!ready || !activePatientId) return;

    const q = query(
      collection(db, "health_records"),
      where("patientId", "==", activePatientId)
    );

    const unsub = onSnapshot(q, (snap) => {
      let temp: SingleVital = null; let hr: SingleVital = null; let bp: BloodPressureVital = null;
      let sugarFasting: SingleVital = null; let sugarAfter: SingleVital = null;
      let hasAnyData = false; let hasFoundLatestSugar = false;

      const newestDocs = [...snap.docs]
        .sort((a, b) => (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0))
        .slice(0, 20);
      newestDocs.forEach((doc) => {
        const d = doc.data() as any;
        const ts = d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now();
        hasAnyData = true;

        if (!temp && d.temperature !== undefined) temp = { val: d.temperature, ts };
        if (!hr && d.heartRate !== undefined) hr = { val: d.heartRate, ts };
        if (!bp && d.bloodPressureSys !== undefined && d.bloodPressureDia !== undefined) {
          bp = { sys: d.bloodPressureSys, dia: d.bloodPressureDia, ts };
        }
        if (!hasFoundLatestSugar && d.bloodSugar !== undefined) {
          hasFoundLatestSugar = true;
          if (d.bloodSugarType === "空腹") {
            sugarFasting = { val: d.bloodSugar, ts };
          } else if (d.bloodSugarType === "飯後" || d.bloodSugarType === "餐後") {
            sugarAfter = { val: d.bloodSugar, ts };
          }
        }
      });

      setVitals({ temp, hr, bp, sugarFasting, sugarAfter, hasAnyData });
    });

    return unsub;
  }, [ready, activePatientId]);

  const checkVitalStatus = (
    type: string,
    data: SingleVital | BloodPressureVital,
    sugarData2?: SingleVital
  ): VitalStatus => {
    if (!data && !sugarData2) return "nodata";

    let latestTs = data?.ts || 0;
    if (sugarData2?.ts && sugarData2.ts > latestTs) latestTs = sugarData2.ts;

    const isOutdated = now - latestTs > 24 * 60 * 60 * 1000;
    if (isOutdated && latestTs !== 0) return "outdated";

    if (type === "temp" && data && "val" in data) {
      const min = dbThresholds.temperature.enabled ? Number(dbThresholds.temperature.min) : 36.0;
      const max = dbThresholds.temperature.enabled ? Number(dbThresholds.temperature.max) : 37.5;
      if (data.val < min || data.val > max) return "abnormal";
    } else if (type === "hr" && data && "val" in data) {
      const min = dbThresholds.heartRate.enabled ? Number(dbThresholds.heartRate.min) : 60;
      const max = dbThresholds.heartRate.enabled ? Number(dbThresholds.heartRate.max) : 100;
      if (data.val < min || data.val > max) return "abnormal";
    } else if (type === "bp" && data && "sys" in data && "dia" in data) {
      const sysMin = dbThresholds.systolic.enabled ? Number(dbThresholds.systolic.min) : 90;
      const sysMax = dbThresholds.systolic.enabled ? Number(dbThresholds.systolic.max) : 140;
      const diaMin = dbThresholds.diastolic.enabled ? Number(dbThresholds.diastolic.min) : 60;
      const diaMax = dbThresholds.diastolic.enabled ? Number(dbThresholds.diastolic.max) : 90;
      if (data.sys < sysMin || data.sys > sysMax || data.dia < diaMin || data.dia > diaMax) {
        return "abnormal";
      }
    } else if (type === "sugar") {
      let isAbnormal = false;
      if (data && "val" in data) {
        const beforeMin = dbThresholds.bloodSugar.enabled ? Number(dbThresholds.bloodSugar.beforeMin) : 70;
        const beforeMax = dbThresholds.bloodSugar.enabled ? Number(dbThresholds.bloodSugar.beforeMax) : 130;
        if (data.val < beforeMin || data.val > beforeMax) isAbnormal = true;
      }
      if (sugarData2) {
        const afterMin = dbThresholds.bloodSugar.enabled ? Number(dbThresholds.bloodSugar.afterMin) : 70;
        const afterMax = dbThresholds.bloodSugar.enabled ? Number(dbThresholds.bloodSugar.afterMax) : 180;
        if (sugarData2.val < afterMin || sugarData2.val > afterMax) isAbnormal = true;
      }
      if (isAbnormal) return "abnormal";
    }

    return "normal";
  };

  const statusLabel: Record<VitalStatus, string> = {
    normal: fc.statusNormal,
    abnormal: fc.statusAbnormal,
    outdated: fc.statusOutdated,
    nodata: fc.statusNoData,
  };

  const formatTime = (ts: number | undefined) => {
    if (!ts) return "";
    const d = new Date(ts);
    const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let label = `${d.getMonth() + 1}/${d.getDate()}`;
    if (d.toDateString() === today.toDateString()) label = t.today;
    else if (d.toDateString() === yesterday.toDateString()) label = t.yesterday;

    return `${label} ${time}`;
  };

  const handleThresholdChange = (field: keyof PatientThresholds, key: string, value: string) => {
    setLocalThresholds(prev => ({
      ...prev,
      [field]: { ...prev[field], [key]: value }
    }));
  };

  const toggleThreshold = (field: keyof PatientThresholds) => {
    setLocalThresholds(prev => ({
      ...prev,
      [field]: { ...prev[field], enabled: !prev[field].enabled }
    }));
  };

  // ─────────────────────────────────────────
  // 防呆：檢查有沒有超過 critical 邊界的設定
  // ─────────────────────────────────────────
  const checkCriticalWarnings = (): string[] => {
    const warnings: string[] = [];

    const fmt = (template: string, val: number, safe: number) =>
      template.replace('{val}', String(val)).replace('{safe}', String(safe));

    if (localThresholds.temperature.enabled) {
      const max = Number(localThresholds.temperature.max);
      const min = Number(localThresholds.temperature.min);
      if (max >= CRITICAL_BOUNDS.temperature.maxSafe)
        warnings.push(fmt(t.tempMaxCriticalWarning, max, CRITICAL_BOUNDS.temperature.maxSafe));
      if (min <= CRITICAL_BOUNDS.temperature.minSafe)
        warnings.push(fmt(t.tempMinCriticalWarning, min, CRITICAL_BOUNDS.temperature.minSafe));
    }

    if (localThresholds.heartRate.enabled) {
      const max = Number(localThresholds.heartRate.max);
      const min = Number(localThresholds.heartRate.min);
      if (max >= CRITICAL_BOUNDS.heartRate.maxSafe)
        warnings.push(fmt(t.hrMaxCriticalWarning, max, CRITICAL_BOUNDS.heartRate.maxSafe));
      if (min <= CRITICAL_BOUNDS.heartRate.minSafe)
        warnings.push(fmt(t.hrMinCriticalWarning, min, CRITICAL_BOUNDS.heartRate.minSafe));
    }

    if (localThresholds.systolic.enabled) {
      const max = Number(localThresholds.systolic.max);
      const min = Number(localThresholds.systolic.min);
      if (max >= CRITICAL_BOUNDS.systolic.maxSafe)
        warnings.push(fmt(t.sysMaxCriticalWarning, max, CRITICAL_BOUNDS.systolic.maxSafe));
      if (min <= CRITICAL_BOUNDS.systolic.minSafe)
        warnings.push(fmt(t.sysMinCriticalWarning, min, CRITICAL_BOUNDS.systolic.minSafe));
    }

    if (localThresholds.diastolic.enabled) {
      const max = Number(localThresholds.diastolic.max);
      const min = Number(localThresholds.diastolic.min);
      if (max >= CRITICAL_BOUNDS.diastolic.maxSafe)
        warnings.push(fmt(t.diaMaxCriticalWarning, max, CRITICAL_BOUNDS.diastolic.maxSafe));
      if (min <= CRITICAL_BOUNDS.diastolic.minSafe)
        warnings.push(fmt(t.diaMinCriticalWarning, min, CRITICAL_BOUNDS.diastolic.minSafe));
    }

    if (localThresholds.bloodSugar.enabled) {
      const beforeMax = Number(localThresholds.bloodSugar.beforeMax);
      const beforeMin = Number(localThresholds.bloodSugar.beforeMin);
      const afterMax  = Number(localThresholds.bloodSugar.afterMax);
      const afterMin  = Number(localThresholds.bloodSugar.afterMin);
      if (beforeMax >= CRITICAL_BOUNDS.bloodSugarBefore.maxSafe)
        warnings.push(fmt(t.sugarBeforeMaxCriticalWarning, beforeMax, CRITICAL_BOUNDS.bloodSugarBefore.maxSafe));
      if (beforeMin <= CRITICAL_BOUNDS.bloodSugarBefore.minSafe)
        warnings.push(fmt(t.sugarBeforeMinCriticalWarning, beforeMin, CRITICAL_BOUNDS.bloodSugarBefore.minSafe));
      if (afterMax >= CRITICAL_BOUNDS.bloodSugarAfter.maxSafe)
        warnings.push(fmt(t.sugarAfterMaxCriticalWarning, afterMax, CRITICAL_BOUNDS.bloodSugarAfter.maxSafe));
      if (afterMin <= CRITICAL_BOUNDS.bloodSugarAfter.minSafe)
        warnings.push(fmt(t.sugarAfterMinCriticalWarning, afterMin, CRITICAL_BOUNDS.bloodSugarAfter.minSafe));
    }

    return warnings;
  };

  const doSave = async () => {
    try {
      await saveThresholds(localThresholds);
      Alert.alert(t.saveSuccessTitle, t.thresholdSaveSuccessMessage);
      setActiveTab("today");
    } catch {
      Alert.alert(t.resultErrorTitle, t.thresholdSaveFailedMessage);
    }
  };

  const handleSave = () => {
    const warnings = checkCriticalWarnings();

    if (warnings.length > 0) {
      Alert.alert(
        t.thresholdWarningTitle,
        `${t.thresholdWarningBody}\n\n${warnings.join("\n")}`,
        [
          { text: t.resetSetting, style: "cancel" },
          { text: t.confirmSaveAnyway, style: "destructive", onPress: doSave },
        ]
      );
      return;
    }

    doSave();
  };

  const handleBackPress = () => {
    const hasChanges = JSON.stringify(dbThresholds) !== JSON.stringify(localThresholds);
    if (hasChanges) {
      Alert.alert(
        t.unsavedChangesTitle,
        t.unsavedChangesMessage,
        [
          { text: t.continueEditingLabel, style: "cancel" },
          {
            text: t.discardChangesLabel,
            style: "destructive",
            onPress: () => {
              setLocalThresholds(dbThresholds);
              setActiveTab("today");
            },
          },
        ]
      );
    } else {
      setActiveTab("today");
    }
  };

  if (!ready || thresholdsLoading) {
    return (
      <View style={styles.container}>
        <AppHeader title={fc.vitalsTitle} fallbackHref="/family" />
        <ActivityIndicator style={{ flex: 1, justifyContent: "center" }} color={colors.primary} />
      </View>
    );
  }

  const dataTypeLabel: Record<ChartDataType, string> = {
    "體溫": t.temperature,
    "心跳": t.heartRate,
    "血壓": t.bloodPressure,
    "血糖": t.bloodSugar,
  };
  const timeRangeLabel: Record<ChartTimeRange, string> = {
    "1周": fc.range1w,
    "2周": fc.range2w,
    "1個月": fc.range1m,
    "全部": fc.rangeAll,
  };

  const renderVitalCard = (
    key: string,
    title: string,
    status: VitalStatus,
    values: { label?: string; value: string | number; unit: string }[],
    ts: number | undefined,
  ) => {
    const timeText = ts ? `${formatTime(ts)} · ${relativeTimeLabel(fc, ts, now)}` : t.noRecord;
    return (
      <VitalCard
        key={key}
        variant="detailed"
        title={title}
        status={status}
        statusLabel={statusLabel[status]}
        values={values}
        meta={timeText}
        accessibilityLabel={`${title}, ${statusLabel[status]}, ${values.map(v => `${v.label ?? ""} ${v.value} ${v.unit}`).join(", ")}, ${timeText}`}
        style={values.length === 1 && styles.vitalCardHalf}
      />
    );
  };

  const renderThresholdSwitch = (enabled: boolean, onToggle: () => void, title: string) => (
    <View style={styles.settingCardHeader}>
      <Text style={styles.settingCardTitle}>{title}</Text>
      <View style={styles.switchContainer}>
        <Text style={[styles.switchLabel, enabled && styles.switchLabelActive]}>
          {enabled ? t.enabledCustomThreshold : t.useSystemDefaultThreshold}
        </Text>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          accessibilityLabel={title}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.surface}
        />
      </View>
    </View>
  );

  const numberInput = (field: keyof PatientThresholds, key: string, value: string, label: string, flex?: boolean) => (
    <TextInput
      style={flex ? styles.textInputFlex : styles.textInput}
      keyboardType="numeric"
      value={value}
      accessibilityLabel={label}
      placeholderTextColor={colors.textMuted}
      onChangeText={(v) => handleThresholdChange(field, key, v)}
    />
  );

  let latestSugarTs = vitals.sugarFasting?.ts || 0;
  if (vitals.sugarAfter?.ts && vitals.sugarAfter.ts > latestSugarTs) latestSugarTs = vitals.sugarAfter.ts;

  return (
    <View style={styles.container}>
      {activeTab === "settings" ? (
        <AppHeader title={t.customThresholdTitle} onBack={handleBackPress} />
      ) : (
        <AppHeader title={fc.vitalsTitle} fallbackHref="/family" />
      )}

      {activeTab !== "settings" ? (
        <SegmentedTabs
          options={[{ key: "history", label: t.historyTrend }, { key: "today", label: t.todayRecords }] as const}
          value={activeTab}
          onChange={setActiveTab}
          style={styles.tabBar}
        />
      ) : null}

      <KeyboardAwareScroll safeAreaBottom={false} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ================= 歷史趨勢 ================= */}
        {activeTab === "history" && (
          <View style={styles.tabContent}>
            <View style={styles.filterRow}>
              {dataTypes.map((type) => (
                <Chip key={type} label={dataTypeLabel[type]} selected={chartDataType === type} onPress={() => setChartDataType(type)} />
              ))}
            </View>
            <View style={styles.filterRow}>
              {timeRanges.map((range) => (
                <Chip key={range} label={timeRangeLabel[range]} selected={chartTimeRange === range} onPress={() => setChartTimeRange(range)} />
              ))}
            </View>
            <HealthTrendChart chartDataType={chartDataType} loading={loading} empty={empty} lineData={lineData} bpSysData={bpSysData} bpDiaData={bpDiaData} />
          </View>
        )}

        {/* ================= 本日紀錄 ================= */}
        {activeTab === "today" && (
          <View style={styles.tabContent}>
            {isPrimaryFamily && (
              <Button
                label={t.settingsButtonLabel}
                icon="options-outline"
                variant="secondary"
                onPress={() => setActiveTab("settings")}
                style={styles.settingsBtn}
              />
            )}

            <View style={styles.vitalGrid}>
              {renderVitalCard("temp", t.temperature, checkVitalStatus("temp", vitals.temp),
                [{ value: vitals.temp?.val ?? "--", unit: "°C" }], vitals.temp?.ts)}
              {renderVitalCard("hr", t.heartRate, checkVitalStatus("hr", vitals.hr),
                [{ value: vitals.hr?.val ?? "--", unit: "bpm" }], vitals.hr?.ts)}
              {renderVitalCard("bp", t.bloodPressure, checkVitalStatus("bp", vitals.bp), [
                { label: t.systolic, value: vitals.bp?.sys ?? "--", unit: "mmHg" },
                { label: t.diastolic, value: vitals.bp?.dia ?? "--", unit: "mmHg" },
              ], vitals.bp?.ts)}
              {renderVitalCard("sugar", t.bloodSugar, checkVitalStatus("sugar", vitals.sugarFasting, vitals.sugarAfter), [
                { label: t.fasting, value: vitals.sugarFasting?.val ?? "--", unit: "mg/dL" },
                { label: t.afterMeal, value: vitals.sugarAfter?.val ?? "--", unit: "mg/dL" },
              ], latestSugarTs > 0 ? latestSugarTs : undefined)}
            </View>
          </View>
        )}

        {/* ================= 設定閾值畫面 ================= */}
        {activeTab === "settings" && (
          <View style={styles.settingsContent}>

            <View style={styles.infoBanner}>
              <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
              <Text style={styles.infoBannerText}>{t.thresholdInfoBanner}</Text>
            </View>

            {/* 1. 體溫設定 */}
            <Card style={[styles.settingCard, localThresholds.temperature.enabled && styles.settingCardActive]}>
              {renderThresholdSwitch(localThresholds.temperature.enabled, () => toggleThreshold("temperature"), t.temperatureWithUnit)}
              {localThresholds.temperature.enabled ? (
                <View style={styles.settingInputRow}>
                  <View style={styles.inputCol}>
                    <Text style={styles.inputLabel}>{t.minSafeValue}</Text>
                    {numberInput("temperature", "min", localThresholds.temperature.min, t.minSafeValue)}
                  </View>
                  <Text style={styles.inputTilde}>~</Text>
                  <View style={styles.inputCol}>
                    <Text style={styles.inputLabel}>{t.maxSafeValue}</Text>
                    {numberInput("temperature", "max", localThresholds.temperature.max, t.maxSafeValue)}
                  </View>
                </View>
              ) : (
                <Text style={styles.disabledText}>{t.thresholdDisabledHint}</Text>
              )}
            </Card>

            {/* 2. 心跳設定 */}
            <Card style={[styles.settingCard, localThresholds.heartRate.enabled && styles.settingCardActive]}>
              {renderThresholdSwitch(localThresholds.heartRate.enabled, () => toggleThreshold("heartRate"), t.heartRateWithUnit)}
              {localThresholds.heartRate.enabled ? (
                <View style={styles.settingInputRow}>
                  <View style={styles.inputCol}>
                    <Text style={styles.inputLabel}>{t.minHeartRateValue}</Text>
                    {numberInput("heartRate", "min", localThresholds.heartRate.min, t.minHeartRateValue)}
                  </View>
                  <Text style={styles.inputTilde}>~</Text>
                  <View style={styles.inputCol}>
                    <Text style={styles.inputLabel}>{t.maxHeartRateValue}</Text>
                    {numberInput("heartRate", "max", localThresholds.heartRate.max, t.maxHeartRateValue)}
                  </View>
                </View>
              ) : (
                <Text style={styles.disabledText}>{t.thresholdDisabledHint}</Text>
              )}
            </Card>

            {/* 3. 血壓設定 */}
            <Card style={[styles.settingCard, localThresholds.systolic.enabled && styles.settingCardActive]}>
              {renderThresholdSwitch(localThresholds.systolic.enabled, () => { toggleThreshold("systolic"); toggleThreshold("diastolic"); }, t.bloodPressureWithUnit)}
              {localThresholds.systolic.enabled ? (
                <>
                  <View style={styles.settingInputRow}>
                    <Text style={styles.inputSideLabel}>{t.systolic}</Text>
                    {numberInput("systolic", "min", localThresholds.systolic.min, `${t.systolic} ${t.minSafeValue}`, true)}
                    <Text style={styles.inputTildeSmall}>~</Text>
                    {numberInput("systolic", "max", localThresholds.systolic.max, `${t.systolic} ${t.maxSafeValue}`, true)}
                  </View>
                  <View style={[styles.settingInputRow, { marginTop: spacing.md }]}>
                    <Text style={styles.inputSideLabel}>{t.diastolic}</Text>
                    {numberInput("diastolic", "min", localThresholds.diastolic.min, `${t.diastolic} ${t.minSafeValue}`, true)}
                    <Text style={styles.inputTildeSmall}>~</Text>
                    {numberInput("diastolic", "max", localThresholds.diastolic.max, `${t.diastolic} ${t.maxSafeValue}`, true)}
                  </View>
                </>
              ) : (
                <Text style={styles.disabledText}>{t.thresholdDisabledHint}</Text>
              )}
            </Card>

            {/* 4. 血糖設定 */}
            <Card style={[styles.settingCard, localThresholds.bloodSugar.enabled && styles.settingCardActive]}>
              {renderThresholdSwitch(localThresholds.bloodSugar.enabled, () => toggleThreshold("bloodSugar"), t.bloodSugarWithUnit)}
              {localThresholds.bloodSugar.enabled ? (
                <>
                  <View style={styles.settingInputRow}>
                    <Text style={styles.inputSideLabel}>{t.fasting}</Text>
                    {numberInput("bloodSugar", "beforeMin", localThresholds.bloodSugar.beforeMin, `${t.fasting} ${t.minSafeValue}`, true)}
                    <Text style={styles.inputTildeSmall}>~</Text>
                    {numberInput("bloodSugar", "beforeMax", localThresholds.bloodSugar.beforeMax, `${t.fasting} ${t.maxSafeValue}`, true)}
                  </View>
                  <View style={[styles.settingInputRow, { marginTop: spacing.md }]}>
                    <Text style={styles.inputSideLabel}>{t.afterMeal}</Text>
                    {numberInput("bloodSugar", "afterMin", localThresholds.bloodSugar.afterMin, `${t.afterMeal} ${t.minSafeValue}`, true)}
                    <Text style={styles.inputTildeSmall}>~</Text>
                    {numberInput("bloodSugar", "afterMax", localThresholds.bloodSugar.afterMax, `${t.afterMeal} ${t.maxSafeValue}`, true)}
                  </View>
                </>
              ) : (
                <Text style={styles.disabledText}>{t.thresholdDisabledHint}</Text>
              )}
            </Card>

            <Button label={t.saveThresholdSettings} icon="checkmark" size="lg" fullWidth onPress={handleSave} style={styles.saveBtn} />

          </View>
        )}

      </KeyboardAwareScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  tabBar: { marginHorizontal: layout.screenPaddingX, marginTop: spacing.md },
  scrollContent: { paddingHorizontal: layout.screenPaddingX, paddingTop: spacing.lg, paddingBottom: spacing.xxxl, gap: 0, width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  tabContent: { flex: 1 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },

  settingsBtn: { alignSelf: "flex-end", marginBottom: spacing.lg },
  vitalGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.md },
  vitalCardHalf: { width: "48%", padding: spacing.md },

  settingsContent: { flex: 1 },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.control,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  infoBannerText: { ...typography.bodySmall, color: colors.text, flex: 1 },
  settingCard: { marginBottom: spacing.lg },
  settingCardActive: { borderColor: colors.primaryBorder },
  settingCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md, flexWrap: "wrap", gap: spacing.md },
  settingCardTitle: { ...typography.header, fontSize: 18, flexShrink: 1 },
  switchContainer: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  switchLabel: { ...typography.caption, fontWeight: "600" },
  switchLabelActive: { color: colors.primary },
  disabledText: { ...typography.bodySmall, color: colors.textMuted },
  settingInputRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  inputCol: { flex: 1, flexDirection: "column" },
  inputLabel: { ...typography.caption, fontWeight: "600", color: colors.textSecondary, marginBottom: spacing.xs, marginLeft: spacing.xs },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    minHeight: 52,
    paddingVertical: spacing.sm,
    minWidth: 0,
  },
  inputTilde: { fontSize: 22, color: colors.textMuted, marginHorizontal: spacing.md, marginTop: spacing.lg },
  inputSideLabel: { ...typography.label, color: colors.textSecondary, width: 56, textAlign: "center" },
  textInputFlex: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    minHeight: 52,
    paddingVertical: spacing.sm,
    minWidth: 0,
  },
  inputTildeSmall: { fontSize: 20, color: colors.textMuted, marginHorizontal: spacing.sm },
  saveBtn: { marginTop: spacing.sm },
});
