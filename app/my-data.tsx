import { functions } from "@/firebase/firebaseConfig";
import { myDataCopy } from "@/src/profile/myDataCopy";
import { myDataExtraCopy } from "@/src/i18n/copy/accountCopy";
import { useAuth } from "@/src/auth/useAuth";
import { useLanguage } from "@/src/store/LanguageContext";
import { AppHeader, Button, Card, Divider, EmptyState, ListRow, SectionHeader } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { Ionicons } from "@expo/vector-icons";
import { httpsCallable } from "firebase/functions";
import { router, type Href } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useScreenBottomInset } from "@/src/ui/BottomInsetContext";

type Summary = {
  profile: {displayName: string; email: string; role: string; createdAt: string | null;
    privacyConsent: {version: string}};
  counts: Record<string, number>;
  media: Record<string, number>;
  recentActivity: {id: string; operation: string; occurredAt: string | null;
    resourceType: string | null; changedFields: string[]}[];
  complete: boolean;
};

export default function MyDataScreen() {
  const bottomInset = useScreenBottomInset();
  const {language} = useLanguage();
  const t = myDataCopy[language];
  const x = myDataExtraCopy[language];
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const {user} = useAuth();
  const uid = user?.uid;
  const [retry, setRetry] = useState(0);
  const scope = `${uid}:${t.failed}:${retry}`;
  const [previousScope, setPreviousScope] = useState<string | null>(null);
  if (previousScope !== scope) {
    setPreviousScope(scope);
    setSummary(null);
    setBusy(true);
    setError("");
  }
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    httpsCallable<Record<string, never>, Summary>(
      functions, "myDataSummary", {timeout: 120000})({}).then(result => {
      if (!cancelled) setSummary(result.data);
    }).catch(reason => {
      console.warn("[my-data]", reason);
      if (!cancelled) setError(t.failed);
    }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [uid, t.failed, retry]);

  const recordRows: [string, string][] = [
    ["careTargets", t.targets], ["prescriptions", t.prescriptions],
    ["health_records", t.health], ["abnormal_records", t.abnormalities],
    ["voice_records", t.voices], ["calendar_events", t.calendars],
    ["care_notes", t.notes], ["daily_checklist_items", t.checklists],
    ["medication_logs", t.medications], ["notifications", t.notifications],
    ["messages", t.messages],
  ];
  const mediaRows: [string, string][] = [
    ["prescriptionImages", t.prescriptionImages], ["abnormalMedia", t.abnormalMedia],
    ["voiceRecordings", t.voiceRecordings], ["chatImages", t.chatImages],
    ["total", t.total],
  ];
  const operation = (value: string) => x.operations[value] || value.replaceAll("_", " ");

  return (
    <View style={styles.screen}>
      <AppHeader title={t.title} left="back" fallbackHref={"/" as Href} />
      <SafeAreaView style={styles.flex} edges={["left", "right"]}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + bottomInset }]}>
          <Text style={styles.scope}>{t.scope}</Text>

          {busy ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>{t.loading}</Text>
            </View>
          ) : null}

          {error ? (
            <Card style={styles.errorCard}>
              <EmptyState
                icon="cloud-offline-outline"
                title={error}
                actionLabel={t.retry}
                onAction={() => setRetry(value => value + 1)}
              />
            </Card>
          ) : null}

          {summary ? (
            <>
              <SectionHeader title={t.profile} />
              <Card padding={0}>
                <Rows rows={[
                  [t.name, summary.profile.displayName || "—"],
                  [t.email, summary.profile.email],
                  [t.role, summary.profile.role === "family" ? t.family : t.caregiver],
                  [t.consent, summary.profile.privacyConsent.version || "—"],
                  [t.created, formatTime(summary.profile.createdAt)],
                ]} />
              </Card>

              <SectionHeader title={x.manageSection} />
              <Card padding={0}>
                <ListRow icon="create-outline" title={t.edit} subtitle={x.editHint}
                  onPress={() => router.push("/profile" as any)} />
                <Divider inset />
                <ListRow icon="download-outline" title={t.export} subtitle={x.exportHint}
                  onPress={() => router.push("/personal-data-export" as any)} />
              </Card>

              <SectionHeader title={t.records} />
              <Card padding={0}>
                <Rows rows={recordRows.map(([key, label]): [string, string] => [label, String(summary.counts[key] ?? 0)])} />
              </Card>

              <SectionHeader title={t.media} />
              <Card padding={0}>
                <Rows rows={mediaRows.map(([key, label]): [string, string] => [label, String(summary.media[key] ?? 0)])} />
              </Card>

              {!summary.complete ? (
                <View style={styles.warning}>
                  <Ionicons name="information-circle" size={20} color={colors.warning} />
                  <Text style={styles.warningText}>{t.incomplete}</Text>
                </View>
              ) : null}

              <SectionHeader title={t.activity} />
              <Card padding={0}>
                {!summary.recentActivity.length ? (
                  <Text style={styles.noActivity}>{t.noActivity}</Text>
                ) : summary.recentActivity.map((item, index) => (
                  <View key={item.id}>
                    {index > 0 ? <Divider inset={spacing.lg} /> : null}
                    <View style={styles.activity}>
                      <Text style={styles.activityTitle}>{operation(item.operation)}</Text>
                      <Text style={styles.muted}>{formatTime(item.occurredAt)}
                        {item.resourceType ? ` · ${item.resourceType}` : ""}</Text>
                      {!!item.changedFields.length && <Text style={styles.muted}>
                        {item.changedFields.join("、")}</Text>}
                    </View>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

/** Settings-style label / value rows; the value stays selectable for copying. */
function Rows({rows}: {rows: [string, string][]}) {
  return <>
    {rows.map(([label, value], index) => (
      <View key={label}>
        {index > 0 ? <Divider inset={spacing.lg} /> : null}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text selectable style={styles.rowValue}>{value}</Text>
        </View>
      </View>
    ))}
  </>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: {
    padding: layout.screenPaddingX,
    paddingBottom: spacing.xxl,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  scope: { ...typography.bodySmall, paddingHorizontal: spacing.xs },
  loading: { paddingVertical: spacing.xxl, alignItems: "center", gap: spacing.md },
  loadingText: { ...typography.body, color: colors.textSecondary },
  errorCard: { marginTop: spacing.lg },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowLabel: { ...typography.body, flex: 1 },
  rowValue: { ...typography.bodyStrong, color: colors.textSecondary, flexShrink: 1, maxWidth: "55%", textAlign: "right" },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.warningSoft,
  },
  warningText: { ...typography.bodySmall, color: colors.warning, flex: 1 },
  noActivity: { ...typography.body, color: colors.textSecondary, padding: spacing.lg },
  activity: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 2 },
  activityTitle: { ...typography.bodyStrong },
  muted: { ...typography.bodySmall, color: colors.textMuted },
});
