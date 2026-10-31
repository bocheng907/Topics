import { useAgencyReports } from "@/src/agency/useAgencyReports";
import type {
  AgencyReport,
  AgencyReportLevel,
  AgencyReportStatus,
} from "@/src/agency/agencyReportTypes";
import { agencyCopy, agencyLocale, type AgencyCopy } from "@/src/i18n/copy/agencyCopy";
import type { Language } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import {
  AppHeader,
  Button,
  Card,
  Divider,
  EmptyState,
  KeyboardAwareScroll,
  ListRow,
  SectionHeader,
  StatusBadge,
  TextField,
  type IconName,
  type StatusTone,
} from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";

import { Ionicons } from "@expo/vector-icons";
import {
  router,
  useLocalSearchParams,
} from "expo-router";

import React, {
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type HandlingState =
  | "pending"
  | "attention"
  | "resolved";

export default function AgencyReportDetailScreen() {
  const { language } = useLanguage();
  const c = agencyCopy[language];

  const params = useLocalSearchParams<{
    reportId?: string | string[];
  }>();

  const reportId = Array.isArray(
    params.reportId
  )
    ? params.reportId[0]
    : params.reportId ?? "";

  const {
    reports,
    loading,
    error,
    updateReport,
  } = useAgencyReports();

  const report = useMemo(
    () =>
      reports.find(
        (item) => item.id === reportId
      ) ?? null,
    [reports, reportId]
  );

  const [
    handlingState,
    setHandlingState,
  ] = useState<HandlingState>("pending");

  const [
    handlingNote,
    setHandlingNote,
  ] = useState("");

  const [saving, setSaving] =
    useState(false);

  const selectedReportId = report?.id;
  const selectedLevel = report?.level;
  const selectedStatus = report?.status;
  const selectedNote = report?.handlingNote;

  const reportVersion = JSON.stringify([selectedReportId, selectedLevel, selectedStatus, selectedNote]);
  const [previousReport, setPreviousReport] = useState<string | null>(null);
  if (previousReport !== reportVersion) {
    setPreviousReport(reportVersion);
    setHandlingNote(selectedNote ?? "");
    setHandlingState(selectedStatus === "resolved" ? "resolved" :
      selectedLevel === "attention" ? "attention" : "pending");
  }

  async function handleSave() {
    if (!report || saving) return;

    let nextLevel:
      AgencyReportLevel =
        report.level;

    let nextStatus:
      AgencyReportStatus =
        "open";

    if (
      handlingState === "pending"
    ) {
      nextLevel = "pending";
      nextStatus = "open";
    }

    if (
      handlingState === "attention"
    ) {
      nextLevel = "attention";
      nextStatus = "open";
    }

    if (
      handlingState === "resolved"
    ) {
      // 保留原本問題等級，
      // 只把處理狀態改成 resolved
      nextLevel =
        report.level === "normal"
          ? "normal"
          : report.level;

      nextStatus = "resolved";
    }

    try {
      setSaving(true);

      await updateReport(
        report.id,
        {
          level: nextLevel,
          status: nextStatus,
          handlingNote,
        }
      );

      Alert.alert(
        c.saveDoneTitle,
        handlingState === "resolved"
          ? c.saveDoneResolved
          : c.saveDoneUpdated,
        [
          {
            text: c.ok,
            onPress: () => {
              router.replace({
                pathname: "/agency/caregiver-detail",
                params: {
                  caregiverUid: report.caregiverUid,
                },
              } as any);
            },
          },
        ]
      );
    } catch (saveError) {
      console.log(
        "[agency report] update failed:",
        saveError
      );

      Alert.alert(
        c.saveFailedTitle,
        c.saveFailedBody
      );
    } finally {
      setSaving(false);
    }
  }

  const header = <AppHeader title={c.reportDetailTitle} left="back" fallbackHref="/agency" />;

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{c.loadingReport}</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centerState}>
          <EmptyState icon="alert-circle-outline" title={c.reportLoadError} body={error} />
        </View>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centerState}>
          <EmptyState icon="document-text-outline" title={c.reportNotFoundTitle} body={c.reportNotFoundBody} />
        </View>
      </View>
    );
  }

  const status = getReportStatus(report, c);

  const options: { key: HandlingState; label: string; icon: IconName; tone: StatusTone }[] = [
    { key: "pending", label: c.pending, icon: "alert-circle-outline", tone: "danger" },
    { key: "attention", label: c.attention, icon: "eye-outline", tone: "warning" },
    { key: "resolved", label: c.resolved, icon: "checkmark-circle-outline", tone: "success" },
  ];

  return (
    <View style={styles.container}>
      {header}

      <KeyboardAwareScroll
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 回報狀態 */}
        <View>
          <View style={styles.statusRow}>
            <StatusBadge label={status.label} tone={status.tone} />
            <Text style={styles.timeText}>{formatReportTime(report.createdAt, language)}</Text>
          </View>

          <Text style={styles.reportTitle} accessibilityRole="header">
            {report.title}
          </Text>
        </View>

        {/* 基本資訊 */}
        <View>
          <SectionHeader title={c.infoSection} style={styles.sectionHeader} />
          <Card padding={0}>
            <ListRow
              icon="person-outline"
              title={`${report.reporterName || c.roleFamily} · ${report.reporterRole === "family" ? c.roleFamily : c.roleCaregiver}`}
              subtitle={c.reporter}
            />
            <Divider inset />
            <ListRow icon="people-outline" title={report.caregiverName} subtitle={c.caregiver} />
            <Divider inset />
            <ListRow icon="heart-outline" title={report.patientName} subtitle={c.careTarget} />
          </Card>
        </View>

        {/* 問題說明 */}
        <View>
          <SectionHeader title={c.descSection} style={styles.sectionHeader} />
          <Card>
            <Text style={[styles.descriptionText, !report.description && { color: colors.textMuted }]} selectable>
              {report.description || c.noDescription}
            </Text>
          </Card>
        </View>

        {/* 處理狀態 */}
        <View>
          <SectionHeader title={c.statusSection} style={styles.sectionHeader} />
          <View style={styles.statusOptions} accessibilityRole="radiogroup">
            {options.map((option) => (
              <StatusOption
                key={option.key}
                label={option.label}
                icon={option.icon}
                tone={option.tone}
                active={handlingState === option.key}
                onPress={() => setHandlingState(option.key)}
              />
            ))}
          </View>
        </View>

        {/* 處理備註 */}
        <TextField
          label={c.noteSection}
          value={handlingNote}
          onChangeText={setHandlingNote}
          placeholder={c.notePlaceholder}
          multiline
          maxLength={3000}
          inputStyle={styles.noteInput}
        />

        <Button
          label={c.save}
          icon="save-outline"
          size="lg"
          fullWidth
          loading={saving}
          disabled={saving}
          onPress={handleSave}
        />

        {report.status === "resolved" && (
          <View style={styles.resolvedInfo}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.resolvedInfoText}>
              {c.resolvedInfo}
              {report.handledAt ? ` · ${formatReportTime(report.handledAt, language)}` : ""}
            </Text>
          </View>
        )}
      </KeyboardAwareScroll>
    </View>
  );
}

const OPTION_TONES: Record<"danger" | "warning" | "success", { fg: string; bg: string }> = {
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  success: { fg: colors.success, bg: colors.successSoft },
};

function StatusOption({
  label,
  icon,
  tone,
  active,
  onPress,
}: {
  label: string;
  icon: IconName;
  tone: StatusTone;
  active: boolean;
  onPress: () => void;
}) {
  const t = OPTION_TONES[tone as keyof typeof OPTION_TONES] ?? OPTION_TONES.danger;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.statusOption,
        active && { borderColor: t.fg, backgroundColor: t.bg },
        pressed && !active && { backgroundColor: colors.surfaceSunken },
      ]}
    >
      <Ionicons name={icon} size={22} color={active ? t.fg : colors.textMuted} />
      <Text style={[styles.statusOptionText, active && { color: t.fg, fontWeight: "700" }]}>{label}</Text>
      <Ionicons
        name={active ? "radio-button-on" : "radio-button-off"}
        size={22}
        color={active ? t.fg : colors.textDisabled}
      />
    </Pressable>
  );
}

function getReportStatus(
  report: AgencyReport,
  c: AgencyCopy
): { label: string; tone: StatusTone } {
  if (
    report.status === "resolved"
  ) {
    return { label: c.resolved, tone: "success" };
  }

  if (
    report.level === "attention"
  ) {
    return { label: c.attention, tone: "warning" };
  }

  return { label: c.pending, tone: "danger" };
}

function formatReportTime(
  timestamp: any,
  language: Language
) {
  if (!timestamp) return "";

  try {
    const date =
      typeof timestamp.toDate ===
      "function"
        ? timestamp.toDate()
        : new Date(timestamp);

    return new Intl.DateTimeFormat(
      agencyLocale[language],
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    ).format(date);
  } catch {
    return "";
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },

  scrollView: {
    flex: 1,
  },

  content: {
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },

  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.sm,
  },

  timeText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },

  reportTitle: {
    ...typography.title,
    marginTop: spacing.md,
  },

  sectionHeader: {
    paddingTop: 0,
  },

  descriptionText: {
    ...typography.body,
  },

  statusOptions: {
    gap: spacing.sm,
  },

  statusOption: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  statusOptionText: {
    ...typography.body,
    flex: 1,
  },

  noteInput: {
    minHeight: 140,
  },

  resolvedInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },

  resolvedInfoText: {
    ...typography.bodySmall,
    color: colors.success,
    fontWeight: "600",
  },
});
