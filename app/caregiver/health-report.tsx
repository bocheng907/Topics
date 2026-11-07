import { AppHeader, Button, Card, Chip, KeyboardAwareScroll, SegmentedTabBar, SegmentedTabs } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { caregiverCopy } from "@/src/i18n/copy/caregiverCopy";
// app/caregiver/health-report.tsx
import { db } from '@/firebase/firebaseConfig';
import type { Href } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import React, { useEffect, useRef, useState } from 'react';
import { saveHealthOnce, type HealthPayload } from '@/src/care-target/reliableWrites';
import { reliabilityCopy } from '@/src/care-target/reliabilityCopy';
import { AppAlert as Alert } from '@/src/ui/AppAlert';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/src/auth/useAuth';
import { useActiveCareTarget } from '@/src/care-target/useActiveCareTarget';
import HealthTrendChart from '@/src/health/HealthTrendChart';
import {
  ChartDataType,
  ChartTimeRange,
  useHealthChartData,
} from '@/src/health/useHealthChartData';
import { translations } from '@/src/i18n/translations';
import { useLanguage } from '@/src/store/LanguageContext';

export default function HealthReportScreen() {
  const { user } = useAuth();
  const { activePatientId } = useActiveCareTarget();
  const { language } = useLanguage();
  const t = translations[language];
  const c = caregiverCopy[language];

  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');

  const [mealTime, setMealTime] = useState<'before' | 'after'>('before');
  const [formData, setFormData] = useState({
    temperature: '',
    heartRate: '',
    systolic: '',
    diastolic: '',
    bloodSugar: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const pending = useRef<{ id: string; payload: HealthPayload } | null>(null);
  const [retryNeeded, setRetryNeeded] = useState(false);
  const scope = `${user?.uid}/${activePatientId}`;
  const scopeRef = useRef(scope);
  const generation = useRef(0);
  const copy = reliabilityCopy[language];
  const [previousScope, setPreviousScope] = useState(scope);
  if (previousScope !== scope) {
    setPreviousScope(scope); setIsSaving(false); setRetryNeeded(false);
    setFormData({ temperature: '', heartRate: '', systolic: '', diastolic: '', bloodSugar: '' });
  }
  useEffect(() => {
    generation.current += 1;
    scopeRef.current = scope;
    pending.current = null;
    savingRef.current = false;
    return () => { scopeRef.current = ''; generation.current += 1; };
  }, [scope]);

  const [chartDataType, setChartDataType] = useState<ChartDataType>('體溫');
  const [chartTimeRange, setChartTimeRange] = useState<ChartTimeRange>('1周');

  const dataTypes: ChartDataType[] = ['體溫', '心跳', '血壓', '血糖'];
  const timeRanges: ChartTimeRange[] = ['1周', '2周', '1個月', '全部'];
  const dataTypeLabels = [t.temperature, t.heartRate, t.bloodPressure, t.bloodSugar];
  const timeRangeLabels = [c.range1W, c.range2W, c.range1M, c.rangeAll];

  const { loading, empty, lineData, bpSysData, bpDiaData } = useHealthChartData({
    patientId: activePatientId ?? undefined,
    chartDataType,
    chartTimeRange,
  });

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    if (savingRef.current || pending.current) return;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateExtremeValues = () => {
    let errorMsg = '';

    if (formData.temperature) {
      const value = Number(formData.temperature);
      if (!Number.isFinite(value) || value < 32 || value > 43) errorMsg += `• ${t.extremeTemperatureRange}\n`;
    }
    if (formData.heartRate) {
      const value = Number(formData.heartRate);
      if (!Number.isFinite(value) || value < 30 || value > 250) errorMsg += `• ${t.extremeHeartRateRange}\n`;
    }
    if (formData.systolic) {
      const value = Number(formData.systolic);
      if (!Number.isFinite(value) || value < 50 || value > 250) errorMsg += `• ${t.extremeSystolicRange}\n`;
    }
    if (formData.diastolic) {
      const value = Number(formData.diastolic);
      if (!Number.isFinite(value) || value < 30 || value > 150) errorMsg += `• ${t.extremeDiastolicRange}\n`;
    }
    if (formData.bloodSugar) {
      const value = Number(formData.bloodSugar);
      if (!Number.isFinite(value) || value < 20 || value > 1000) errorMsg += `• ${t.extremeBloodSugarRange}\n`;
    }

    return errorMsg;
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    if (!user || !activePatientId) {
      Alert.alert(t.resultErrorTitle, t.noSelectedPatient);
      return;
    }

    const hasData = Object.values(formData).some((val) => val.trim() !== '');
    if (!hasData) {
      Alert.alert(t.prompt, t.noVitals);
      return;
    }

    const extremeError = validateExtremeValues();
    if (extremeError) {
      Alert.alert(
        t.extremeValueTitle,
        extremeError + '\n' + t.extremeValueSuffix
      );
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    const submittedScope = scope;
    const submittedGeneration = generation.current;

    try {
      const payload: HealthPayload = {
        patientId: activePatientId,
        caregiverId: user.uid,
      };

      if (formData.temperature) payload.temperature = Number(formData.temperature);
      if (formData.heartRate) payload.heartRate = Number(formData.heartRate);
      if (formData.systolic) payload.bloodPressureSys = Number(formData.systolic);
      if (formData.diastolic) payload.bloodPressureDia = Number(formData.diastolic);

      if (formData.bloodSugar) {
        payload.bloodSugar = Number(formData.bloodSugar);
        payload.bloodSugarType = mealTime === 'before' ? '空腹' : '餐後';
      }

      pending.current ??= { id: randomUUID(), payload };
      await saveHealthOnce(db, pending.current.id, pending.current.payload);
      if (scopeRef.current !== submittedScope || generation.current !== submittedGeneration) return;
      pending.current = null;
      setRetryNeeded(false);

      Alert.alert(t.saveSuccessTitle, t.saveSuccessMessage);

      setFormData({
        temperature: '',
        heartRate: '',
        systolic: '',
        diastolic: '',
        bloodSugar: '',
      });

      setActiveTab('history');
    } catch (error) {
      if (scopeRef.current !== submittedScope || generation.current !== submittedGeneration) return;
      console.log('Save health record error:', error);
      setRetryNeeded(true);
      Alert.alert(t.resultSaveFailedTitle, copy.failed);
    } finally {
      if (scopeRef.current === submittedScope && generation.current === submittedGeneration) {
        savingRef.current = false;
        setIsSaving(false);
      }
    }
  };

  const inputsLocked = isSaving || retryNeeded;

  return (
    <View style={styles.container}>
      <AppHeader title={t.dailyHealthReport} fallbackHref={"/caregiver" as Href} />
      <SegmentedTabBar>
        <SegmentedTabs
          options={[
            { key: 'today', label: t.todayRecords },
            { key: 'history', label: t.historyTrend },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </SegmentedTabBar>

      {activeTab === 'today' ? (
        <KeyboardAwareScroll contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Card style={styles.formCard}>
            <VitalInput
              label={t.temperature}
              unit="°C"
              value={formData.temperature}
              placeholder="36.5"
              editable={!inputsLocked}
              onChangeText={(val) => handleInputChange('temperature', val)}
            />
            <VitalInput
              label={t.heartRate}
              unit="bpm"
              value={formData.heartRate}
              placeholder="80"
              editable={!inputsLocked}
              onChangeText={(val) => handleInputChange('heartRate', val)}
            />
          </Card>

          <Card style={styles.formCard}>
            <Text style={styles.groupTitle}>{t.bloodPressure}</Text>
            <VitalInput
              label={t.systolic}
              unit="mmHg"
              value={formData.systolic}
              placeholder="120"
              editable={!inputsLocked}
              onChangeText={(val) => handleInputChange('systolic', val)}
            />
            <VitalInput
              label={t.diastolic}
              unit="mmHg"
              value={formData.diastolic}
              placeholder="80"
              editable={!inputsLocked}
              onChangeText={(val) => handleInputChange('diastolic', val)}
            />
          </Card>

          <Card style={styles.formCard}>
            <Text style={styles.groupTitle}>{t.bloodSugar}</Text>
            <SegmentedTabs
              options={[
                { key: 'before', label: t.fasting },
                { key: 'after', label: t.afterMeal },
              ]}
              value={mealTime}
              onChange={setMealTime}
              disabled={inputsLocked}
            />
            <VitalInput
              label={t.bloodSugar}
              unit="mg/dL"
              value={formData.bloodSugar}
              placeholder="90"
              editable={!inputsLocked}
              onChangeText={(val) => handleInputChange('bloodSugar', val)}
            />
          </Card>

          {retryNeeded && <Text accessibilityRole="alert" style={styles.errorText}>{copy.failed}</Text>}
          <Button label={t.save} size="lg" fullWidth onPress={handleSave} loading={isSaving} disabled={isSaving} />
        </KeyboardAwareScroll>
      ) : (
        <KeyboardAwareScroll contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.filterRow}>
            {dataTypes.map((type, index) => (
              <Chip
                key={type}
                label={dataTypeLabels[index]}
                selected={chartDataType === type}
                onPress={() => setChartDataType(type)}
                style={styles.filterChip}
              />
            ))}
          </View>

          <View style={styles.filterRow}>
            {timeRanges.map((range, index) => (
              <Chip
                key={range}
                label={timeRangeLabels[index]}
                selected={chartTimeRange === range}
                onPress={() => setChartTimeRange(range)}
                style={styles.filterChip}
              />
            ))}
          </View>

          <HealthTrendChart
              chartDataType={chartDataType}
              loading={loading}
              empty={empty}
              lineData={lineData}
              bpSysData={bpSysData}
              bpDiaData={bpDiaData}
            />
        </KeyboardAwareScroll>
      )}
    </View>
  );
}

function VitalInput({
  label,
  unit,
  value,
  placeholder,
  editable,
  onChangeText,
}: {
  label: string;
  unit: string;
  value: string;
  placeholder: string;
  editable: boolean;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.inputRow}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={[styles.inputField, !editable && styles.inputFieldDisabled, webNoOutline]}
          keyboardType="numeric"
          value={value}
          editable={editable}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textDisabled}
          accessibilityLabel={`${label} (${unit})`}
        />
        <Text style={styles.unitText}>{unit}</Text>
      </View>
    </View>
  );
}

const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  formCard: { gap: spacing.md },
  groupTitle: { ...typography.header },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  inputLabel: { ...typography.bodyStrong, fontSize: 19, flex: 1, minWidth: 96 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inputField: {
    width: 128,
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  inputFieldDisabled: { backgroundColor: colors.surfaceSunken, color: colors.textMuted },
  unitText: { ...typography.body, color: colors.textSecondary, width: 64 },
  errorText: { ...typography.body, color: colors.danger, fontWeight: '600' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterChip: { minHeight: 48, paddingHorizontal: spacing.lg },
});
