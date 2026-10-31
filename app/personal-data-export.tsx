import { userErrorCopy } from "@/src/ui/userErrorMessages";
import { exportStepsCopy } from "@/src/i18n/copy/accountCopy";
import { AppHeader, Button, Card, Divider, KeyboardAwareScroll, SectionHeader, StatusBadge, TextField } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { Ionicons } from "@expo/vector-icons";
import { auth, functions } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { exportCopy } from "@/src/export/exportCopy";
import { exportDiagnostic, exportDiagnosticHint, type ExportStage } from "@/src/export/exportDiagnostic";
import { type ExportPayload, validateExportPayload } from "@/src/export/exportPayload";
import { saveExport } from "@/src/export/saveExport";
import { useLanguage } from "@/src/store/LanguageContext";
import { httpsCallable } from "firebase/functions";
import { reauthenticateUser, requiresPasswordReauthentication } from "@/src/auth/reauthenticate";
import type { Href } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { AppState, Platform, StyleSheet, Text, View } from "react-native";


export default function PersonalDataExportScreen() {
  const {user} = useAuth();
  const {language} = useLanguage();
  const t = exportCopy[language];
  const errorCopy = userErrorCopy[language];
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [diagnostic, setDiagnostic] = useState("");
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [prepared, setPrepared] = useState<{payload: ExportPayload; uid: string; at: number} | null>(null);
  const passwordRequired = requiresPasswordReauthentication(auth.currentUser);
  const locked = useRef(false);
  const epoch = useRef(0);
  const [accountScope, setAccountScope] = useState(user?.uid);
  if (accountScope !== user?.uid) {
    setAccountScope(user?.uid);
    setPrepared(null); setPassword(""); setDiagnostic("");
    setShowDiagnostic(false);
  }
  useEffect(() => {
    epoch.current++;
    // This numeric generation guard intentionally invalidates pending requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { epoch.current++; };
  }, [user?.uid]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", state => {
      if (state !== "active") {
        epoch.current++;
        setPrepared(null);
        setPassword("");
      }
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!prepared) return;
    const timer = setTimeout(() => {
      setPrepared(null);
      setStatus(t.expired);
    }, Math.max(0, 300000 - (Date.now() - prepared.at)));
    return () => clearTimeout(timer);
  }, [prepared, t.expired]);

  async function generate() {
    const current = auth.currentUser;
    if (locked.current || !current || (passwordRequired && !password) ||
        current.uid !== user?.uid) return;
    locked.current = true;
    setBusy(true);
    setStatus("");
    setShowDiagnostic(false);
    setDiagnostic("");
    setPrepared(null);
    const attempt = epoch.current;
    let verified = false;
    let stage: ExportStage = "reauth";
    try {
      setPassword("");
      await reauthenticateUser(current, password);
      stage = "token";
      await current.getIdToken(true);
      verified = true;
      if (auth.currentUser?.uid !== current.uid || attempt !== epoch.current) return;
      stage = "request";
      const response = await httpsCallable<Record<string, never>, ExportPayload>(
        functions, "exportPersonalData", {timeout: 240000})({});
      if (auth.currentUser?.uid !== current.uid || attempt !== epoch.current) return;
      stage = "validate";
      validateExportPayload(response.data, current.uid);
      setPrepared({payload: response.data, uid: current.uid, at: Date.now()});
    } catch (error) {
      if (attempt !== epoch.current) return;
      const info = exportDiagnostic(error, stage);
      const code = info.code;
      setDiagnostic(info.id);
      console.warn("[personal-data-export]", info);
      const hint = exportDiagnosticHint(info.reason, language);
      setStatus(!verified ? t.authFailed :
        hint || (code === "functions/resource-exhausted" ? t.limited : t.failed));
    } finally {
      locked.current = false;
      setBusy(false);
      setPassword("");
    }
  }

  async function save() {
    if (locked.current || !prepared) return;
    if (auth.currentUser?.uid !== prepared.uid || Date.now() - prepared.at > 300000) {
      setPrepared(null);
      setStatus(t.expired);
      return;
    }
    locked.current = true;
    setBusy(true);
    setDiagnostic("");
    setShowDiagnostic(false);
    try {
      await saveExport(prepared.payload, prepared.uid);
      setStatus(t.done);
    } catch (error) {
      const info = exportDiagnostic(error, "save");
      setDiagnostic(info.id);
      console.warn("[personal-data-export]", info);
      setStatus((error as Error).message === "sharing-unavailable" ? t.unavailable : t.failed);
    } finally {
      locked.current = false;
      setBusy(false);
      setPrepared(null);
    }
  }


    const s = exportStepsCopy[language];
  const missingPassword = passwordRequired && !password;
  const saved = status === t.done && !prepared;
  const generating = busy && !prepared;
  const verifyState: StepState = prepared || saved ? "done" : "active";
  const generateState: StepState = prepared || saved ? "done" : generating ? "working" : "active";
  const saveState: StepState = saved ? "done" : prepared ? (busy ? "working" : "active") : "pending";
  const statusTone = status === t.done ? "success" : status === t.expired ? "warning" : "danger";
  const stepCopy = { label: s.stepLabel, working: s.stepWorking, done: s.stepDone };

  return (
    <View style={styles.screen}>
      {/* Leaving is blocked while verification / export is in flight, as before. */}
      <AppHeader title={t.title} left="back" fallbackHref={"/my-data" as Href} onBack={busy ? () => {} : undefined} />
      <KeyboardAwareScroll contentContainerStyle={styles.content}>
        <SectionHeader title={s.aboutSection} style={styles.firstSection} />
        <Card>
          <Text style={styles.body}>{t.description}</Text>
        </Card>

        <SectionHeader title={s.securitySection} />
        <Card tone="sunken" style={styles.noteCard}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.noteText}>{t.warning}</Text>
        </Card>

        <Card padding={0} style={styles.steps}>
          <Step n={1} title={s.stepVerify} state={verifyState} copy={stepCopy}>
            <Text style={styles.hint}>{passwordRequired ? s.stepVerifyHint : s.stepVerifyHintOther}</Text>
            {passwordRequired ? (
              <TextField
                label={t.password}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
              />
            ) : null}
          </Step>
          <Divider />
          <Step n={2} title={s.stepGenerate} state={generateState} copy={stepCopy}>
            <Button
              label={generating ? t.busy : t.generate}
              icon="document-text-outline"
              size="lg"
              fullWidth
              loading={generating}
              disabled={busy || missingPassword}
              onPress={generate}
            />
          </Step>
          <Divider />
          <Step n={3} title={s.stepSave} state={saveState} copy={stepCopy}>
            {prepared ? (
              <>
                <Text style={styles.readyTitle}>{t.ready}</Text>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>{t.count}</Text>
                  <Text style={styles.resultValue}>
                    {Object.values(prepared.payload.counts).reduce((sum, n) => sum + n, 0)}
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>{t.skipped}</Text>
                  <Text style={styles.resultValue}>{prepared.payload.skippedInaccessible}</Text>
                </View>
                <Button
                  label={Platform.OS === "web" ? t.download : t.share}
                  icon={Platform.OS === "web" ? "download-outline" : "share-outline"}
                  size="lg"
                  fullWidth
                  loading={busy}
                  disabled={busy}
                  onPress={save}
                />
                <Text style={styles.hint}>{s.stepSaveHint}</Text>
              </>
            ) : saveState === "pending" ? (
              <Text style={styles.hint}>{s.stepPending}</Text>
            ) : null}
          </Step>
        </Card>

        {status ? (
          <View accessibilityRole="alert" style={[styles.status, { backgroundColor: toneColors[statusTone].bg }]}>
            <Ionicons name={toneColors[statusTone].icon} size={20} color={toneColors[statusTone].fg} />
            <Text style={[styles.statusText, { color: toneColors[statusTone].fg }]}>{status}</Text>
          </View>
        ) : null}

        {diagnostic ? (
          <View style={styles.diagnostic}>
            <Button
              label={showDiagnostic ? errorCopy.hideDetails : errorCopy.details}
              icon={showDiagnostic ? "chevron-up" : "chevron-down"}
              variant="ghost"
              onPress={() => setShowDiagnostic(value => !value)}
              accessibilityLabel={showDiagnostic ? errorCopy.hideDetails : errorCopy.details}
            />
            {showDiagnostic ? (
              <Card tone="sunken" style={styles.diagnosticCard}>
                <Text style={styles.hint}>{errorCopy.detailsHint}</Text>
                <Text selectable style={styles.diagnosticCode}>{diagnostic}</Text>
              </Card>
            ) : null}
          </View>
        ) : null}
      </KeyboardAwareScroll>
    </View>
  );
}

type StepState = "pending" | "active" | "working" | "done";

const toneColors = {
  success: { bg: colors.successSoft, fg: colors.success, icon: "checkmark-circle" },
  warning: { bg: colors.warningSoft, fg: colors.warning, icon: "time-outline" },
  danger: { bg: colors.dangerSoft, fg: colors.danger, icon: "alert-circle" },
} as const;

function Step({ n, title, state, copy, children }: {
  n: number;
  title: string;
  state: StepState;
  copy: { label: (n: number) => string; working: string; done: string };
  children?: React.ReactNode;
}) {
  const done = state === "done";
  const pending = state === "pending";
  return (
    <View style={styles.step}>
      <View style={styles.stepHead}>
        <View style={[styles.stepNumber, done && styles.stepNumberDone, pending && styles.stepNumberPending]}>
          {done ? (
            <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
          ) : (
            <Text style={[styles.stepNumberText, pending && styles.stepNumberTextPending]}>{n}</Text>
          )}
        </View>
        <View style={styles.stepTitleBox}>
          <Text style={styles.stepOverline}>{copy.label(n)}</Text>
          <Text style={[styles.stepTitle, pending && styles.stepTitlePending]} accessibilityRole="header">{title}</Text>
        </View>
        {done ? <StatusBadge label={copy.done} tone="success" icon="checkmark-circle" /> : null}
        {state === "working" ? <StatusBadge label={copy.working} tone="primary" icon="hourglass-outline" /> : null}
      </View>
      {children ? <View style={styles.stepBody}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { gap: 0, width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center" },
  firstSection: { paddingTop: spacing.sm },
  body: { ...typography.body },
  noteCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  noteText: { ...typography.body, color: colors.textSecondary, flex: 1 },
  steps: { marginTop: spacing.xl },
  step: { padding: spacing.lg, gap: spacing.md },
  stepHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexWrap: "wrap" },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberDone: { backgroundColor: colors.success },
  stepNumberPending: { backgroundColor: colors.surfaceSunken },
  stepNumberText: { ...typography.label, color: colors.onPrimary },
  stepNumberTextPending: { color: colors.textMuted },
  stepTitleBox: { flex: 1, minWidth: 140 },
  stepOverline: { ...typography.caption },
  stepTitle: { ...typography.bodyStrong },
  stepTitlePending: { color: colors.textMuted },
  stepBody: { gap: spacing.md, paddingLeft: 32 + spacing.md },
  hint: { ...typography.bodySmall },
  readyTitle: { ...typography.bodyStrong, color: colors.success },
  resultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md },
  resultLabel: { ...typography.bodySmall, flex: 1 },
  resultValue: { ...typography.bodyStrong },
  status: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.control,
  },
  statusText: { ...typography.body, fontWeight: "600", flex: 1 },
  diagnostic: { marginTop: spacing.md, gap: spacing.sm },
  diagnosticCard: { gap: spacing.sm },
  diagnosticCode: { ...typography.body, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) },
});
