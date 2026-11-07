import { auth } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import * as Clipboard from "expo-clipboard";
import { router, useCanGoBack } from "expo-router";
import { signOut } from "@/src/auth/auditSession";
import React, { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { createRetryCopy } from "@/src/care-target/createRetryCopy";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { StyleSheet, Text, View } from "react-native";
import { careTargetCopy } from "@/src/i18n/copy/careTargetCopy";
import { AppHeader, Button, Card, KeyboardAwareScroll, TextField } from "@/src/ui/components";
import { colors, layout, spacing, typography } from "@/src/ui/theme";

import { createCareTarget, joinCareTarget } from "@/src/care-target/careTargetApi";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { invitationCopy } from "@/src/care-target/invitationCopy";

export default function CareTargetCreateScreen() {
  const { user } = useAuth();
  return <CareTargetCreateForm key={user?.uid || "signed-out"} />;
}

function CareTargetCreateForm() {
  const { user } = useAuth();
  const { setActivePatientId } = useActiveCareTarget();
  const { language } = useLanguage();
  const t = translations[language];
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [created, setCreated] = useState<{uid: string; patientId: string; inviteCode: string} | null>(null);
  const submitting = useRef(false);
  const [pending, setPending] = useState<{uid: string; requestId: string; name: string; notes: string} | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [retryNotice, setRetryNotice] = useState("");
  const [storageError, setStorageError] = useState(false);
  const canGoBack = useCanGoBack();
  const retryCopy = createRetryCopy[language];
  const ct = careTargetCopy[language];
  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) return;
    const uid = user.uid;
    AsyncStorage.getItem(`care-create-pending:${uid}`).then(raw => {
      if (cancelled) return;
      if (raw) {
        const value = JSON.parse(raw);
        if (value.uid !== uid || typeof value.requestId !== "string" ||
            typeof value.name !== "string" || typeof value.notes !== "string") throw Error("invalid-draft");
        setPending(value); setName(value.name); setNotes(value.notes);
      }
      setDraftReady(true);
    }).catch(() => { if (!cancelled) setStorageError(true); });
    return () => { cancelled = true; };
  }, [user?.uid]);

  const onCreate = async () => {
    if (!user || !draftReady || busy || submitting.current) return;

    if (user.role !== "family") {
      Alert.alert(t.cannotCreate, t.createFamilyOnly);
      return;
    }

    const trimmedName = name.trim();
    const trimmedNotes = notes.trim();

    if (!trimmedName) {
      Alert.alert(t.prompt, t.enterElderName);
      return;
    }

    setBusy(true);
    submitting.current = true;
    const uid = user.uid;
    let sent = false;
    try {
      const attempt = pending?.uid === uid ? pending :
        {uid, requestId: randomUUID(), name: trimmedName, notes: trimmedNotes};
      // Persist before sending: leaving/reloading the page must reuse the same ID.
      await AsyncStorage.setItem(`care-create-pending:${uid}`, JSON.stringify(attempt));
      if (auth.currentUser?.uid !== uid) return;
      setPending(attempt); setRetryNotice("");
      sent = true;
      const result = created?.uid === user.uid ? created :
        (await createCareTarget({ name: attempt.name, notes: attempt.notes, requestId: attempt.requestId })).data;
      if (auth.currentUser?.uid !== uid) return;
      setCreated({ ...result, uid: user.uid });
      const code = result.inviteCode;
      await setActivePatientId(result.patientId);
      await AsyncStorage.removeItem(`care-create-pending:${uid}`);
      setPending(null);

      Alert.alert(
        t.createSuccess,
        `${trimmedName}\n${t.inviteCode}：${code}\n${t.inviteValidity}`,
        [
          {
            text: t.copyAndEnterHome,
            onPress: async () => {
              try { await Clipboard.setStringAsync(code); }
              catch { Alert.alert(t.prompt, `${t.inviteCode}：${code}`); }
              router.replace("/family");
            },
          },
        ]
      );
    } catch (e: any) {
      if (auth.currentUser?.uid !== uid) return;
      console.log("create patient error:", e);
      // These server responses guarantee that no new target was committed.
      // Unknown/network failures must retain their original request ID.
      if (!created && ["functions/invalid-argument", "functions/resource-exhausted"].includes(e?.code)) {
        try {
          await AsyncStorage.removeItem(`care-create-pending:${uid}`);
          setPending(null);
          setRetryNotice("");
          Alert.alert(t.createFailed, t.tryLater);
          return;
        } catch {
          // Keep the saved request locked if clearing local storage fails.
        }
      }
      setRetryNotice(sent ? retryCopy.failed : retryCopy.storage);

      if (e?.code === "functions/permission-denied") {
        Alert.alert(t.createFailed, t.noCreatePermission);
        return;
      }

      Alert.alert(t.prompt, sent ? retryCopy.failed : retryCopy.storage);
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  };


  const onJoinByInvite = async () => {
    if (!user || joining) return;
    const code = inviteCode.trim().toUpperCase();
    if (code.length < 4 || code.length > 8) {
      Alert.alert(t.prompt, t.inviteCodePlaceholder);
      return;
    }
    setJoining(true);
    try {
      const { data: result } = await joinCareTarget({ code });
      if (result.status === "approved" || result.alreadyJoined) {
        await setActivePatientId(result.patientId);
        Alert.alert(t.joinSuccess, t.selectCareTarget, [
          { text: t.startUse, onPress: () => router.replace("/family") },
        ]);
      } else {
        Alert.alert(t.prompt, invitationCopy[language].submitted);
      }
    } catch (e: any) {
      console.log("join by invite from create screen failed:", e);
      Alert.alert(t.joinFailed, t.checkInviteCode);
    } finally {
      setJoining(false);
    }
  };

  const leaveScreen = async () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    try {
      await signOut(auth);
      router.replace("/login");
    } catch (error) {
      console.error("登出失敗:", error);
    }
  };

  const formLocked = !draftReady || !!pending || !!created || busy;

  return (
    <View style={styles.container}>
      {/* Without history the only way out is signing out, which stays an explicit button below. */}
      <AppHeader title={t.createCareTarget} left={canGoBack ? "back" : "none"} />
      <KeyboardAwareScroll contentContainerStyle={styles.content}>
        {!busy && !!(storageError || retryNotice || pending) && (
          <Card tone="sunken" style={styles.notice}>
            <Text accessibilityRole="alert" style={styles.noticeText}>
              {storageError ? retryCopy.storage : retryNotice || retryCopy.pending}
            </Text>
          </Card>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">{ct.createSection}</Text>
          <Text style={styles.helper}>{ct.createHint}</Text>
        </View>

        <TextField
          label={t.elderName}
          required
          value={name}
          editable={!formLocked}
          maxLength={200}
          onChangeText={setName}
          placeholder={t.elderNamePlaceholder}
        />

        <TextField
          label={t.careNotesOptional}
          value={notes}
          editable={!formLocked}
          maxLength={5000}
          onChangeText={setNotes}
          placeholder={t.careNotesPlaceholder}
          multiline
          numberOfLines={4}
        />

        <Button
          label={pending ? retryCopy.retry : t.confirmCreate}
          size="lg"
          fullWidth
          loading={busy}
          disabled={!draftReady || busy || !name.trim()}
          onPress={onCreate}
        />

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>{ct.orDivider}</Text>
          <View style={styles.orLine} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">{t.joinByInviteCode}</Text>
          <Text style={styles.helper}>{t.askInviteCode}</Text>
        </View>

        <TextField
          label={t.inviteCode}
          value={inviteCode}
          onChangeText={setInviteCode}
          maxLength={8}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={t.inviteCodePlaceholder}
          inputStyle={styles.codeInput}
        />
        <Button
          label={t.joinNow}
          variant="secondary"
          size="lg"
          fullWidth
          loading={joining}
          disabled={joining || inviteCode.trim().length < 4}
          onPress={onJoinByInvite}
        />

        <Button
          label={canGoBack ? t.back : t.logoutAndBack}
          variant="ghost"
          fullWidth
          onPress={leaveScreen}
        />
      </KeyboardAwareScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: {
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
    gap: spacing.lg,
  },
  notice: { backgroundColor: colors.warningSoft, borderColor: colors.warningSoft },
  noticeText: { ...typography.body, color: colors.warning },
  section: { gap: spacing.xs },
  sectionTitle: { ...typography.header },
  helper: { ...typography.bodySmall },
  orRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.sm },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  orText: { ...typography.label, color: colors.textMuted },
  codeInput: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 3,
  },
});
