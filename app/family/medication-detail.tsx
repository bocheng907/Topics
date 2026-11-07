// app/family/medication-detail.tsx
import React, { useLayoutEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
} from "react-native";
import { router, useLocalSearchParams, useNavigation, } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader, Card, Divider, EmptyState } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { translations } from "@/src/i18n/translations";
import { familyCopy } from "@/src/i18n/copy/familyCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { useScreenBottomInset } from "@/src/ui/BottomInsetContext";

type MedicationRecord = {
  prescriptionId: string;
  prescriptionTitle: string;
  title?: string;
  createdAt: any;
  dosage?: string;
  usage?: string;
  memo?: string;
};

function safeParseArray(value?: string) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(createdAt: any, unknownText: string) {
  if (!createdAt) return unknownText;

  if (typeof createdAt === "string") return createdAt;

  if (createdAt?.seconds) {
    return new Date(createdAt.seconds * 1000).toLocaleDateString();
  }

  return unknownText;
}

function splitUsage(usage: string | undefined, notProvided: string) {
  const parts = String(usage ?? "")
    .split(/[，,]/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    method: parts[0] || notProvided,
    time: parts.slice(1).join("，") || notProvided,
  };
}

export default function FamilyMedicationDetailScreen() {
  const bottomInset = useScreenBottomInset();
    const navigation = useNavigation();

    useLayoutEffect(() => {
      navigation.setOptions({
        headerShown: false,
      });
    }, [navigation]);
  const { language } = useLanguage();
  const t = translations[language];
  const fc = familyCopy[language];
  const sep = language === "zh" ? "：" : ": ";

  const { name, recordsJson, purposesJson, sourceLabel } =
    useLocalSearchParams<{
      name?: string;
      recordsJson?: string;
      purposesJson?: string;
      sourceLabel?: string;
    }>();

  const records = useMemo(
    () => safeParseArray(recordsJson) as MedicationRecord[],
    [recordsJson]
  );

  const purposes = useMemo(
    () => safeParseArray(purposesJson) as string[],
    [purposesJson]
  );

  // 顯示用：來源字串（資料值為中文）轉為目前語系
  const rawSource = sourceLabel || "藥單資料";
  const sourceText =
    rawSource === "AI 補充" ? fc.aiSupplement
      : rawSource === "藥單辨識" ? t.prescriptionRecognition
        : rawSource === "藥單資料" ? fc.medicationData
          : rawSource;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <AppHeader title={name || fc.drugNamePlaceholder} fallbackHref="/family/list" />

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xxxl + bottomInset }]}>
        <Card style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="medical-outline" size={24} color={colors.primary} />
            </View>
            <Text style={styles.drugName}>{name || fc.drugNamePlaceholder}</Text>
          </View>

          <View style={styles.purposeRow}>
            <Text style={styles.purposeLabel}>{t.commonUses}</Text>

            {purposes.length > 0 ? (
              purposes.slice(0, 3).map((purpose) => (
                <View key={purpose} style={styles.purposeTag}>
                  <Text style={styles.purposeTagText}>{purpose}</Text>
                </View>
              ))
            ) : (
              <View style={[styles.purposeTag, styles.emptyTag]}>
                <Text style={styles.emptyTagText}>{t.none}</Text>
              </View>
            )}
          </View>

          <Text style={styles.sourceText}>
            {t.dataSource}{sep}{sourceText}
          </Text>
        </Card>

        <Text style={styles.sectionLabel} accessibilityRole="header">
          {fc.medicationRecordCount(records.length)}
        </Text>

        {records.length === 0 ? (
          <EmptyState icon="document-text-outline" title={fc.noMedicationRecords} />
        ) : (
          records.map((record, index) => {
            const usage = splitUsage(record.usage, fc.notProvided);

            return (
              <Card
                key={`${record.prescriptionId}-${index}`}
                padding={0}
                style={styles.recordCard}
                accessibilityLabel={record.prescriptionTitle || record.title || t.prescriptionName}
                onPress={() =>
                  router.push({
                    pathname: "/family/detail",
                    params: { id: record.prescriptionId },
                  })
                }
              >
                <View style={styles.recordHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.recordTitle}>
                      {record.prescriptionTitle || record.title || t.prescriptionName}
                    </Text>
                    <Text style={styles.recordDate}>
                      {t.date}{sep}{formatDate(record.createdAt, t.unknown)}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>

                <Divider />

                <View style={styles.infoBlock}>
                  <InfoLine label={fc.dosageLabel} value={record.dosage || fc.notProvided} />
                  <InfoLine label={fc.usageMethodLabel} value={usage.method} />
                  <InfoLine label={fc.usageTimeLabel} value={usage.time} />
                  <InfoLine label={fc.memoLabel} value={record.memo || t.none} muted />
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function InfoLine({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, muted && { color: colors.textSecondary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: {
    padding: layout.screenPaddingX,
    paddingBottom: spacing.xxxl,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  summaryCard: { gap: spacing.md },
  summaryTopRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  drugName: { ...typography.title, flex: 1 },
  purposeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  purposeLabel: { ...typography.label, color: colors.textSecondary, marginRight: 2 },
  purposeTag: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    maxWidth: "100%",
  },
  purposeTagText: { ...typography.label, color: colors.primary },
  emptyTag: { backgroundColor: colors.surfaceSunken },
  emptyTagText: { ...typography.label, color: colors.textMuted },
  sourceText: { ...typography.bodySmall, color: colors.textMuted },

  sectionLabel: { ...typography.overline, marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: spacing.xs },

  recordCard: { marginBottom: spacing.md },
  recordHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  recordTitle: { ...typography.bodyStrong, fontSize: 18 },
  recordDate: { ...typography.bodySmall, color: colors.textMuted, marginTop: 2 },
  infoBlock: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  infoLine: { gap: 2 },
  infoLabel: { ...typography.caption, fontWeight: "600", color: colors.textSecondary },
  infoValue: { ...typography.body },
});
