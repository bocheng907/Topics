import { auth, functions } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { exportCopy } from "@/src/export/exportCopy";
import { exportDiagnostic, exportDiagnosticHint, type ExportStage } from "@/src/export/exportDiagnostic";
import { type ExportPayload, validateExportPayload } from "@/src/export/exportPayload";
import { saveExport } from "@/src/export/saveExport";
import { useLanguage } from "@/src/store/LanguageContext";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View } from "react-native";

export default function PersonalDataExportScreen() {
  const {user} = useAuth();
  const {language} = useLanguage();
  const t = exportCopy[language];
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [diagnostic, setDiagnostic] = useState("");
  const [prepared, setPrepared] = useState<{payload: ExportPayload; uid: string; at: number} | null>(null);
  const locked = useRef(false);
  const epoch = useRef(0);
  useEffect(() => {
    epoch.current++;
    setPrepared(null);
    setPassword("");
    setDiagnostic("");
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
    if (locked.current || !current?.email || !password || current.uid !== user?.uid) return;
    locked.current = true;
    setBusy(true);
    setStatus("");
    setDiagnostic("");
    setPrepared(null);
    const attempt = epoch.current;
    let verified = false;
    let stage: ExportStage = "reauth";
    try {
      const credential = EmailAuthProvider.credential(current.email, password);
      setPassword("");
      await reauthenticateWithCredential(current, credential);
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

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} disabled={busy} accessibilityRole="button">
        <Text style={styles.link}>{t.back}</Text>
      </Pressable>
      <Text style={styles.title}>{t.title}</Text>
      <Text style={styles.body}>{t.description}</Text>
      <View style={styles.warning}><Text style={styles.body}>{t.warning}</Text></View>
      <TextInput secureTextEntry value={password} onChangeText={setPassword}
        placeholder={t.password} accessibilityLabel={t.password} autoCapitalize="none"
        autoCorrect={false} editable={!busy} style={styles.input} />
      <Pressable onPress={generate} disabled={busy || !password}
        accessibilityRole="button" style={[styles.button, (busy || !password) && styles.disabled]}>
        <Text style={styles.buttonText}>{busy ? t.busy : t.generate}</Text>
      </Pressable>
      {busy && <ActivityIndicator />}
      {prepared && <View style={styles.result}>
        <Text style={styles.subtitle}>{t.ready}</Text>
        <Text>{t.count}: {Object.values(prepared.payload.counts).reduce((sum, n) => sum + n, 0)}</Text>
        <Text>{t.skipped}: {prepared.payload.skippedInaccessible}</Text>
        <Pressable onPress={save} disabled={busy} accessibilityRole="button" style={styles.button}>
          <Text style={styles.buttonText}>{Platform.OS === "web" ? t.download : t.share}</Text>
        </Pressable>
      </View>}
      {!!status && <Text accessibilityRole="alert" style={styles.body}>{status}</Text>}
      {!!diagnostic && <Text selectable style={styles.body}>{diagnostic}</Text>}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: {padding: 24, paddingTop: 60, gap: 18, maxWidth: 720, width: "100%", alignSelf: "center"},
  title: {fontSize: 26, fontWeight: "700"}, subtitle: {fontSize: 19, fontWeight: "600"},
  body: {fontSize: 16, lineHeight: 25}, link: {color: "#1264A3", fontSize: 16},
  warning: {backgroundColor: "#FFF3D6", padding: 16, borderRadius: 12},
  input: {borderWidth: 1, borderColor: "#777", padding: 14, borderRadius: 10, fontSize: 16},
  button: {backgroundColor: "#1264A3", padding: 16, borderRadius: 10},
  buttonText: {color: "#FFF", fontSize: 16, textAlign: "center", fontWeight: "600"},
  disabled: {opacity: 0.45}, result: {gap: 12, padding: 16, backgroundColor: "#EFF7FF", borderRadius: 12},
});
