import { ScreenScrollView } from "@/src/ui/ScreenLayout";
import React, { useEffect, useRef, useState } from "react";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import * as Clipboard from "expo-clipboard";
import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { useLanguage } from "@/src/store/LanguageContext";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { primaryFamilyUid } from "@/src/care-target/permissions";
import { invitationCopy } from "@/src/care-target/invitationCopy";
import { manageInvitation, type InvitationState } from "@/src/care-target/careTargetApi";

function ActionButton({label, onPress, busy}: {label: string; onPress: () => void; busy: boolean}) {
  return <Pressable disabled={busy} onPress={onPress} style={{padding: 14, backgroundColor: busy ? "#ddd" : "#e8f2ff", borderRadius: 8}}><Text>{label}</Text></Pressable>;
}

export default function InvitationsScreen() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { language } = useLanguage();
  const t = invitationCopy[language];
  const { activePatientId: patientId, activePatient } = useActiveCareTarget();
  const key = `${uid}:${patientId}`;
  const latestKey = useRef(key);
  useEffect(() => { latestKey.current = key; }, [key]);
  const [role, setRole] = useState<{key: string; primary: boolean}>();
  const [state, setState] = useState<{key: string; data: InvitationState}>();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeScope, setNoticeScope] = useState(key);
  if (noticeScope !== key) { setNoticeScope(key); setNotice(""); }
  const primary = role?.key === key && role.primary;
  const data = state?.key === key && primary ? state.data : undefined;
  useEffect(() => {
    if (!patientId || !uid) return;
    return onSnapshot(doc(db, "patients", patientId), snap => {
      setRole({key, primary: snap.exists() && primaryFamilyUid(snap.data()) === uid});
    }, () => setRole({key, primary: false}));
  }, [key, patientId, uid]);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requestScope = `${key}:${primary}:${refreshVersion}`;
  const [previousScope, setPreviousScope] = useState<string | null>(null);
  if (previousScope !== requestScope) {
    setPreviousScope(requestScope);
    setBusy(Boolean(patientId && primary));
    setError(false);
  }
  useEffect(() => {
    if (!patientId || !primary) return;
    let cancelled = false;
    manageInvitation({patientId, action: "get"}).then(result => {
      if (!cancelled) setState({key, data: result.data});
    }).catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [patientId, primary, key, refreshVersion]);
  const perform = async (action: "regenerate" | "revoke" | "approve" | "reject") => {
    if (!patientId || !primary || lock.current) return;
    lock.current = true; setBusy(true); setError(false);
    try {
      await manageInvitation({patientId, action, requestId: data?.requestId});
      if (latestKey.current === key) {
        const result = await manageInvitation({patientId, action: "get"});
        if (latestKey.current === key) setState({key, data: result.data});
      }
    } catch { if (latestKey.current === key) setError(true); }
    finally { lock.current = false; if (latestKey.current === key) setBusy(false); }
  };
  const confirm = (action: "regenerate" | "revoke" | "approve" | "reject") => {
    Alert.alert(t.confirm, action === "approve" ? t.applicant + "\n" + data?.applicantUid : t.warning, [
      {text: t.cancel, style: "cancel"}, {text: t[action], onPress: () => { void perform(action); }},
    ]);
  };
  const confirmTransfer = (targetUid: string) => {
    Alert.alert(t.transferTitle, t.transferWarning + "\n\n" + targetUid, [
      {text: t.cancel, style: "cancel"},
      {text: t.transfer, style: "destructive", onPress: async () => {
        if (!patientId || !primary || lock.current) return;
        lock.current = true; setBusy(true); setError(false); setNotice("");
        try {
          await manageInvitation({patientId, action: "transfer", targetUid});
          if (latestKey.current === key) {
            setRole({key, primary: false});
            setState(undefined);
            setNotice(t.transferred);
          }
        } catch {
          if (latestKey.current === key) setError(true);
        } finally {
          lock.current = false; if (latestKey.current === key) setBusy(false);
        }
      }},
    ]);
  };
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const expired = data && data.expiresAt <= now;
  return <ScreenScrollView contentContainerStyle={{padding: 24, paddingTop: 20, gap: 18}}>
    <ActionButton label={t.back} busy={busy} onPress={() => router.replace(user?.role === "caregiver" ? "/caregiver" : "/family")} />
    <Text style={{fontSize: 25, fontWeight: "800"}}>{t.title}</Text>
    <Text>{activePatient?.name}</Text>
    <Text>{!patientId ? t.noPatient : role?.key !== key ? t.loading : primary ? t.primary : user?.role === "family" ? t.secondary : t.caregiver}</Text>
    {!primary && <Text>{t.primaryOnly}</Text>}
    {error && <Text style={{color: "#b00020"}}>{t.error}</Text>}
    {!!notice && <Text style={{color: "#176B34"}}>{notice}</Text>}
    {primary && <>
      <Text>{t.validity}</Text>
      <ActionButton label={t.refresh} busy={busy} onPress={() => setRefreshVersion(value => value + 1)} />
      {data && <View style={{gap: 12}}>
        <Text>{t[data.status as keyof typeof t] || data.status}{data.status === "active" && expired ? ` (${t.expired})` : ""}</Text>
        {data.status === "active" && !expired && <Pressable onPress={() => { void Clipboard.setStringAsync(data.code); }}><Text selectable style={{fontSize: 30, letterSpacing: 5}}>{data.code}</Text></Pressable>}
        <Text>{t.expires}: {data.expiresAt ? new Date(data.expiresAt).toLocaleString() : "—"}</Text>
        {data.status === "pending" && <>
          <Text selectable>{t.applicant}: {data.applicantUid}</Text>
          <Text>{t.role}: {data.role === "family" ? t.secondary : t.caregiver}</Text>
          <ActionButton label={t.approve} busy={busy} onPress={() => confirm("approve")} />
          <ActionButton label={t.reject} busy={busy} onPress={() => confirm("reject")} />
        </>}
        <Text>{t.warning}</Text>
        <ActionButton label={t.regenerate} busy={busy} onPress={() => confirm("regenerate")} />
        <ActionButton label={t.revoke} busy={busy} onPress={() => confirm("revoke")} />
        <Text style={{fontSize: 19, fontWeight: "700", marginTop: 12}}>
          {t.transferTitle}</Text>
        <Text>{t.transferWarning}</Text>
        {!(data.secondaryFamilyUids || []).length && <Text>{t.noSecondary}</Text>}
        {(data.secondaryFamilyUids || []).map(targetUid =>
          <View key={targetUid} style={{gap: 8, padding: 12,
            borderWidth: 1, borderColor: "#ddd", borderRadius: 8}}>
            <Text selectable>{targetUid}</Text>
            <ActionButton label={t.transfer} busy={busy} onPress={() => confirmTransfer(targetUid)} />
          </View>)}
      </View>}
    </>}
  </ScreenScrollView>;
}
