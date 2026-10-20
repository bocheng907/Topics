import { ScreenScrollView } from "@/src/ui/ScreenLayout";
import { auth } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { signOut } from "@/src/auth/auditSession";
import React, { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { createRetryCopy } from "@/src/care-target/createRetryCopy";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { Pressable, Text, TextInput, View } from "react-native";

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
  const retryCopy = createRetryCopy[language];
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

  return (
    <ScreenScrollView contentContainerStyle={{ padding: 24, paddingTop: 20, gap: 20 }}>
      <Text style={{ fontSize: 28, fontWeight: "900" }}>{t.createCareTarget}</Text>
      {!busy && !!(storageError || retryNotice || pending) && <Text accessibilityRole="alert" style={{color: "#8A4300", lineHeight: 24}}>
        {storageError ? retryCopy.storage : retryNotice || retryCopy.pending}
      </Text>}

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: "#444" }}>{t.elderName}</Text>
        <TextInput
          value={name}
          editable={draftReady && !pending && !created && !busy}
          maxLength={200}
          onChangeText={setName}
          placeholder={t.elderNamePlaceholder}
          style={{
            borderWidth: 1,
            borderColor: "#DDD",
            borderRadius: 12,
            padding: 16,
            fontSize: 16,
            backgroundColor: "#FFF",
          }}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: "#444" }}>{t.careNotesOptional}</Text>
        <TextInput
          value={notes}
          editable={draftReady && !pending && !created && !busy}
          maxLength={5000}
          onChangeText={setNotes}
          placeholder={t.careNotesPlaceholder}
          multiline
          numberOfLines={4}
          style={{
            borderWidth: 1,
            borderColor: "#DDD",
            borderRadius: 12,
            padding: 16,
            fontSize: 16,
            backgroundColor: "#FFF",
            height: 120,
            textAlignVertical: "top",
          }}
        />
      </View>

      <View style={{ marginTop: 8, paddingTop: 20, borderTopWidth: 1, borderTopColor: "#E5E5EA", gap: 10 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: "#333" }}>{t.joinByInviteCode}</Text>
        <Text style={{ fontSize: 14, color: "#666", lineHeight: 20 }}>{t.askInviteCode}</Text>
        <TextInput
          value={inviteCode}
          onChangeText={setInviteCode}
          maxLength={8}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={t.inviteCodePlaceholder}
          style={{
            borderWidth: 1, borderColor: "#007AFF", borderRadius: 12, padding: 16,
            fontSize: 22, fontWeight: "800", textAlign: "center", letterSpacing: 3, backgroundColor: "#F9FBFF",
          }}
        />
        <Pressable
          onPress={onJoinByInvite}
          disabled={joining || inviteCode.trim().length < 4}
          style={{ backgroundColor: !joining && inviteCode.trim().length >= 4 ? "#34A853" : "#CCC", padding: 16, borderRadius: 12 }}
        >
          <Text style={{ color: "#FFF", textAlign: "center", fontWeight: "900", fontSize: 17 }}>
            {joining ? "…" : t.joinNow}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onCreate}
        disabled={!draftReady || busy || !name.trim()}
        style={{
          backgroundColor: draftReady && name.trim() && !busy ? "#007AFF" : "#CCC",
          padding: 18,
          borderRadius: 12,
          marginTop: 10,
        }}
      >
        <Text style={{ color: "#FFF", textAlign: "center", fontWeight: "900", fontSize: 18 }}>
          {pending ? retryCopy.retry : t.confirmCreate}
        </Text>
      </Pressable>

      <Pressable
        onPress={async () => {
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
        }}
      >
        <Text style={{ color: "#666", textAlign: "center", fontWeight: "700" }}>
          {router.canGoBack() ? t.back : t.logoutAndBack}
        </Text>
      </Pressable>
    </ScreenScrollView>
  );
}
