import React, { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { leaveCareTarget } from "@/src/care-target/careTargetApi";
import { careTargetCopy } from "@/src/i18n/copy/careTargetCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { AppAlert } from "@/src/ui/AppAlert";
import { AppHeader, Button, Card } from "@/src/ui/components";
import { colors, layout, spacing, typography } from "@/src/ui/theme";

export default function LeaveCareTargetScreen() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = careTargetCopy[language];
  const insets = useSafeAreaInsets();
  const { activePatientId, activePatient, forgetCareTarget } = useActiveCareTarget();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const allowed = user?.role === "caregiver" && !!activePatientId;

  async function leave(patientId: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      await leaveCareTarget({ patientId });
      // Membership is already removed. Local storage failure must not imply rollback.
      try { await forgetCareTarget(patientId); } catch { /* memory cleared first */ }
      AppAlert.alert(t.leaveTitle, t.leaveDone, [{ text: t.back, onPress: () => router.replace("/care-target/select") }]);
    } catch (e) {
      const code = (e as {code?: string}).code;
      setError(code === "functions/not-found" ? t.leaveNotDeployed : t.leaveFailed);
    } finally { lock.current = false; setBusy(false); }
  }

  return (
    <View style={styles.container}>
      <AppHeader
        title={t.leaveTitle}
        left="back"
        onBack={() => {
          if (busy) return;
          if (router.canGoBack()) router.back();
          else router.replace("/caregiver");
        }}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + insets.bottom }]}>
        {!!activePatient?.name && (
          <Card>
            <Text style={styles.label}>{t.careTarget}</Text>
            <Text style={styles.patientName}>{activePatient.name}</Text>
          </Card>
        )}

        <Text style={styles.body}>{allowed ? t.leaveBody : t.leaveUnavailable}</Text>

        {!!error && (
          <Card tone="sunken" style={styles.errorCard}>
            <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
          </Card>
        )}

        {allowed && (
          <Button
            label={t.leaveConfirm}
            variant="danger"
            size="lg"
            fullWidth
            loading={busy}
            disabled={busy}
            onPress={() => {
              const id = activePatientId;
              if (!id) return;
              AppAlert.alert(t.leaveTitle, `${activePatient?.name ?? ""}\n\n${t.leaveBody}`, [
                { text: t.cancel, style: "cancel" },
                { text: t.leaveConfirm, style: "destructive", onPress: () => { void leave(id); } },
              ]);
            }}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: {
    padding: layout.screenPaddingX,
    gap: spacing.lg,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  label: { ...typography.overline },
  patientName: { ...typography.title, marginTop: spacing.xs },
  body: { ...typography.body, color: colors.textSecondary },
  errorCard: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  errorText: { ...typography.body, color: colors.danger },
});
