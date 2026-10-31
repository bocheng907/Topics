import { AppHeader, Card, Divider, EmptyState, StatusBadge } from "@/src/ui/components";
import { colors, layout, spacing, typography } from "@/src/ui/theme";
import { caregiverCopy, sourceLabelText } from "@/src/i18n/copy/caregiverCopy";
import { useLanguage } from "@/src/store/LanguageContext";
// app/caregiver/medication-detail.tsx
import React, { useLayoutEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
} from "react-native";
import { router, useLocalSearchParams, useNavigation, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

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

function formatDate(createdAt: any, unknown: string) {
  if (!createdAt) return unknown;
  if (typeof createdAt === "string") return createdAt;
  if (createdAt?.seconds) {
    return new Date(createdAt.seconds * 1000).toLocaleDateString();
  }
  return unknown;
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

export default function CaregiverMedicationDetailScreen() {
  const { language } = useLanguage();
  const c = caregiverCopy[language];
  const sep = language === "zh" ? "：" : ": ";

  const navigation = useNavigation();
    useLayoutEffect(() => {
      navigation.setOptions({
        headerShown: false,
      });
    }, [navigation]);
    
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <AppHeader title={c.medTitle} fallbackHref={"/caregiver/list" as Href} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card tone="selected" style={styles.summaryCard}>
          <Text style={styles.drugName}>{name || c.medDrugNameFallback}</Text>
          <Text style={styles.summaryCount}>{c.medRecordCount(records.length)}</Text>

          <View style={styles.purposeRow}>
            <Text style={styles.purposeLabel}>{c.medCommonUses}</Text>
            {purposes.length > 0 ? (
              purposes.slice(0, 3).map((purpose) => (
                <StatusBadge key={purpose} label={purpose} tone="primary" style={styles.purposeTag} />
              ))
            ) : (
              <StatusBadge label={c.none} tone="neutral" style={styles.purposeTag} />
            )}
          </View>

          <Text style={styles.sourceText}>
            {c.medSource}{sep}{sourceLabel ? sourceLabelText(sourceLabel, language) : c.medSourceDefault}
          </Text>
        </Card>

        {records.length === 0 ? (
          <EmptyState icon="document-text-outline" title={c.medNoRecords} />
        ) : (
          records.map((record, index) => {
            const usage = splitUsage(record.usage, c.medNotProvided);

            return (
              <Card
                key={`${record.prescriptionId}-${index}`}
                padding={0}
                style={styles.recordCard}
                accessibilityLabel={record.prescriptionTitle || record.title || c.medPrescriptionFallback}
                onPress={() =>
                  router.push({
                    pathname: "/caregiver/detail",
                    params: { id: record.prescriptionId },
                  })
                }
              >
                <View style={styles.recordHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.recordTitle}>
                      {record.prescriptionTitle || record.title || c.medPrescriptionFallback}
                    </Text>
                    <Text style={styles.recordDate}>
                      {c.medDate}{sep}{formatDate(record.createdAt, c.medUnknown)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={colors.textMuted} />
                </View>

                <Divider />

                <View style={styles.infoBlock}>
                  <InfoLine label={c.medDosage} value={record.dosage || c.medNotProvided} />
                  <InfoLine label={c.medMethod} value={usage.method} />
                  <InfoLine label={c.medTime} value={usage.time} />
                  <Text style={styles.noteText}>
                    {c.medNote}{sep}{record.memo || c.none}
                  </Text>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: {
    padding: layout.screenPaddingX,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  summaryCard: { gap: spacing.sm, marginBottom: spacing.sm },
  drugName: { ...typography.title },
  summaryCount: { ...typography.bodyStrong, color: colors.primary },
  purposeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  purposeLabel: { ...typography.label, color: colors.textSecondary },
  purposeTag: { alignSelf: "auto" },
  sourceText: { ...typography.bodySmall },
  recordCard: {},
  recordHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  recordTitle: { ...typography.header, marginBottom: 2 },
  recordDate: { ...typography.bodySmall },
  infoBlock: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 2 },
  infoRow: { flexDirection: "row", gap: spacing.md, paddingVertical: 3 },
  infoLabel: { ...typography.bodySmall, color: colors.textMuted, width: 96 },
  infoValue: { ...typography.bodyStrong, flex: 1 },
  noteText: { ...typography.bodySmall, marginTop: spacing.xs },
});
