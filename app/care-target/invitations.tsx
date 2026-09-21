import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { Pressable, ScrollView, Text, View } from "react-native";
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

export default function InvitationsScreen() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { language } = useLanguage();
  const t = invitationCopy[language];
  const { activePatientId: patientId, activePatient } = useActiveCareTarget();
  const key = `${uid}:${patientId}`;
  const latestKey = useRef(key);
  latestKey.current = key;
  const [role, setRole] = useState<{key: string; primary: boolean}>();
  const [state, setState] = useState<{key: string; data: InvitationState}>();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState(false);
  const primary = role?.key === key && role.primary;
  const data = state?.key === key && primary ? state.data : undefined;
  useEffect(() => {
    if (!patientId || !uid) return;
    return onSnapshot(doc(db, "patients", patientId), snap => {
      setRole({key, primary: snap.exists() && primaryFamilyUid(snap.data()) === uid});
    }, () => setRole({key, primary: false}));
  }, [key, patientId, uid]);
  const refresh = useCallback(async () => {
    if (!patientId || !primary || lock.current) return;
    lock.current = true; setBusy(true); setError(false);
    try {
      const result = await manageInvitation({patientId, action: "get"});
      if (latestKey.current === key) setState({key, data: result.data});
    } catch { if (latestKey.current === key) setError(true); }
    finally { lock.current = false; setBusy(false); }
  }, [patientId, primary, key]);
  useEffect(() => { void refresh(); }, [refresh]);
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
    finally { lock.current = false; setBusy(false); }
  };
  const confirm = (action: "regenerate" | "revoke" | "approve" | "reject") => {
    Alert.alert(t.confirm, action === "approve" ? t.applicant + "\n" + data?.applicantUid : t.warning, [
      {text: t.cancel, style: "cancel"}, {text: t[action], onPress: () => { void perform(action); }},
    ]);
  };
  const button = (label: string, action: () => void) => <Pressable disabled={busy} onPress={action} style={{padding: 14, backgroundColor: busy ? "#ddd" : "#e8f2ff", borderRadius: 8}}><Text>{label}</Text></Pressable>;
  const expired = data && data.expiresAt <= Date.now();
  return <ScrollView contentContainerStyle={{padding: 24, paddingTop: 70, gap: 18}}>
    {button(t.back, () => router.replace(user?.role === "caregiver" ? "/caregiver" : "/family"))}
    <Text style={{fontSize: 25, fontWeight: "800"}}>{t.title}</Text>
    <Text>{activePatient?.name}</Text>
    <Text>{!patientId ? t.noPatient : role?.key !== key ? t.loading : primary ? t.primary : user?.role === "family" ? t.secondary : t.caregiver}</Text>
    {!primary && <Text>{t.primaryOnly}</Text>}
    {error && <Text style={{color: "#b00020"}}>{t.error}</Text>}
    {primary && <>
      <Text>{t.validity}</Text>
      {button(t.refresh, () => { void refresh(); })}
      {data && <View style={{gap: 12}}>
        <Text>{t[data.status as keyof typeof t] || data.status}{data.status === "active" && expired ? ` (${t.expired})` : ""}</Text>
        {data.status === "active" && !expired && <Pressable onPress={() => { void Clipboard.setStringAsync(data.code); }}><Text selectable style={{fontSize: 30, letterSpacing: 5}}>{data.code}</Text></Pressable>}
        <Text>{t.expires}: {data.expiresAt ? new Date(data.expiresAt).toLocaleString() : "—"}</Text>
        {data.status === "pending" && <>
          <Text selectable>{t.applicant}: {data.applicantUid}</Text>
          <Text>{t.role}: {data.role === "family" ? t.secondary : t.caregiver}</Text>
          {button(t.approve, () => confirm("approve"))}
          {button(t.reject, () => confirm("reject"))}
        </>}
        <Text>{t.warning}</Text>
        {button(t.regenerate, () => confirm("regenerate"))}
        {button(t.revoke, () => confirm("revoke"))}
      </View>}
    </>}
  </ScrollView>;
}
