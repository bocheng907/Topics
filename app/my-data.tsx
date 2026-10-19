import { ScreenScrollView } from "@/src/ui/ScreenLayout";
import { functions } from "@/firebase/firebaseConfig";
import { myDataCopy } from "@/src/profile/myDataCopy";
import { useAuth } from "@/src/auth/useAuth";
import { useLanguage } from "@/src/store/LanguageContext";
import { httpsCallable } from "firebase/functions";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

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
  const {language} = useLanguage();
  const t = myDataCopy[language];
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
  const operation = (value: string) => ({
    login: "登入", logout_requested: "登出請求",
    personal_data_export: "匯出個人資料",
    personal_data_summary_viewed: "查閱我的資料",
    profile_update: "更正個人資料",
  } as Record<string, string>)[value] || value.replaceAll("_", " ");

  return <ScreenScrollView contentContainerStyle={styles.container}>
    <Pressable onPress={() => router.back()}><Text style={styles.link}>{t.back}</Text></Pressable>
    <Text style={styles.title}>{t.title}</Text>
    <Text style={styles.scope}>{t.scope}</Text>
    {busy && <View style={styles.loading}><ActivityIndicator /><Text>{t.loading}</Text></View>}
    {!!error && <View style={styles.card}><Text accessibilityRole="alert">{error}</Text>
      <Pressable style={styles.button} onPress={() => setRetry(value => value + 1)}><Text style={styles.buttonText}>{t.retry}</Text></Pressable>
    </View>}
    {summary && <>
      <Section title={t.profile}>
        <Row label={t.name} value={summary.profile.displayName || "—"} />
        <Row label={t.email} value={summary.profile.email} />
        <Row label={t.role} value={summary.profile.role === "family" ? t.family : t.caregiver} />
        <Row label={t.consent} value={summary.profile.privacyConsent.version || "—"} />
        <Row label={t.created} value={formatTime(summary.profile.createdAt)} />
        <Pressable style={styles.button} onPress={() => router.push("/profile" as any)}>
          <Text style={styles.buttonText}>{t.edit}</Text>
        </Pressable>
      </Section>
      <Section title={t.records}>
        {recordRows.map(([key, label]) => <Row key={key} label={label}
          value={String(summary.counts[key] ?? 0)} />)}
      </Section>
      <Section title={t.media}>
        {mediaRows.map(([key, label]) => <Row key={key} label={label}
          value={String(summary.media[key] ?? 0)} />)}
      </Section>
      {!summary.complete && <Text style={styles.warning}>{t.incomplete}</Text>}
      <Section title={t.activity}>
        {!summary.recentActivity.length && <Text>{t.noActivity}</Text>}
        {summary.recentActivity.map(item => <View key={item.id} style={styles.activity}>
          <Text style={styles.activityTitle}>{operation(item.operation)}</Text>
          <Text style={styles.muted}>{formatTime(item.occurredAt)}
            {item.resourceType ? ` · ${item.resourceType}` : ""}</Text>
          {!!item.changedFields.length && <Text style={styles.muted}>
            {item.changedFields.join("、")}</Text>}
        </View>)}
      </Section>
      <Pressable style={styles.secondary} onPress={() => router.push("/personal-data-export" as any)}>
        <Text style={styles.secondaryText}>{t.export}</Text>
      </Pressable>
    </>}
  </ScreenScrollView>;
}

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}
function Section({title, children}: {title: string; children: React.ReactNode}) {
  return <View style={styles.card}><Text style={styles.heading}>{title}</Text>{children}</View>;
}
function Row({label, value}: {label: string; value: string}) {
  return <View style={styles.row}><Text style={styles.label}>{label}</Text>
    <Text selectable style={styles.value}>{value}</Text></View>;
}
const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 20, paddingBottom: 40, gap: 16, maxWidth: 760, width: "100%", alignSelf: "center" },
  title: {fontSize: 28, fontWeight: "800"}, link: {color: "#1264A3", fontSize: 16},
  scope: {fontSize: 15, lineHeight: 23, color: "#555"},
  loading: {padding: 30, alignItems: "center", gap: 12},
  card: {backgroundColor: "#FFF", borderWidth: 1, borderColor: "#DDD",
    borderRadius: 14, padding: 16, gap: 11},
  heading: {fontSize: 20, fontWeight: "700", marginBottom: 3},
  row: {flexDirection: "row", justifyContent: "space-between", gap: 18},
  label: {fontSize: 15, color: "#555", flex: 1},
  value: {fontSize: 15, fontWeight: "600", flex: 1, textAlign: "right"},
  button: {backgroundColor: "#1264A3", padding: 14, borderRadius: 10, marginTop: 8},
  buttonText: {color: "#FFF", fontWeight: "700", textAlign: "center"},
  secondary: {borderWidth: 1, borderColor: "#1264A3", padding: 14, borderRadius: 10},
  secondaryText: {color: "#1264A3", fontWeight: "700", textAlign: "center"},
  warning: {backgroundColor: "#FFF3D6", padding: 14, borderRadius: 10, lineHeight: 22},
  activity: {borderTopWidth: 1, borderColor: "#EEE", paddingTop: 10, gap: 4},
  activityTitle: {fontSize: 15, fontWeight: "600"}, muted: {fontSize: 13, color: "#666"},
});
