import React, { useEffect, useRef, useState } from "react";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { careTargetCopy } from "@/src/i18n/copy/careTargetCopy";
import { AppHeader, Button, Card, SectionHeader, StatusBadge, type StatusTone } from "@/src/ui/components";
import UserAvatar from "@/src/ui/components/UserAvatar";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
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

const STATUS_TONE: Record<string, StatusTone> = { active: "success", pending: "warning", approved: "success", rejected: "danger" };

export default function InvitationsScreen() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { language } = useLanguage();
  const t = invitationCopy[language];
  const ct = careTargetCopy[language];
  const insets = useSafeAreaInsets();
  const [copiedCode, setCopiedCode] = useState("");
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
    Alert.alert(t.confirm, action === "approve" ? t.applicant + "\n" + applicantName : t.warning, [
      {text: t.cancel, style: "cancel"}, {text: t[action], onPress: () => { void perform(action); }},
    ]);
  };
  const confirmTransfer = (targetUid: string, targetName: string) => {
    Alert.alert(t.transferTitle, t.transferWarning + "\n\n" + targetName, [
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
  const goHome = () => router.replace(user?.role === "caregiver" ? "/caregiver" : "/family");
  const roleLabel = !patientId ? t.noPatient : role?.key !== key ? t.loading : primary ? t.primary : user?.role === "family" ? t.secondary : t.caregiver;
  const showCode = !!data && data.status === "active" && !expired;
  const secondaryUids = data?.secondaryFamilyUids || [];
  // 只顯示名稱與頭像；沒有名稱時用角色標籤，絕不顯示 UID
  const secondaryProfiles = new Map((data?.secondaryFamilyProfiles || []).map(p => [p.uid, p]));
  const applicantName = data?.applicant?.displayName || (data?.role === "family" ? t.familyMember : t.caregiver);

  return <View style={styles.container}>
    <AppHeader
      title={t.title}
      left="back"
      onBack={() => { if (!busy) goHome(); }}
      right={primary ? <Button label={t.refresh} variant="ghost" icon="refresh" disabled={busy} onPress={() => setRefreshVersion(value => value + 1)} /> : undefined}
    />
    <ScrollView contentContainerStyle={[styles.content, {paddingBottom: spacing.xxl + insets.bottom}]}>
      <Card>
        <Text style={styles.overline}>{ct.careTarget}</Text>
        <Text style={styles.patientName}>{activePatient?.name || "—"}</Text>
        <View style={styles.roleRow}>
          <Text style={styles.roleLabel}>{ct.yourRole}</Text>
          <StatusBadge label={roleLabel} tone={primary ? "primary" : "neutral"} />
        </View>
      </Card>

      {!primary && <Text style={styles.helper}>{t.primaryOnly}</Text>}
      {error && <Card style={styles.errorCard}><Text accessibilityRole="alert" style={styles.errorText}>{t.error}</Text></Card>}
      {!!notice && <Card style={styles.successCard}><Text accessibilityLiveRegion="polite" style={styles.successText}>{notice}</Text></Card>}

      {primary && <>
        {data && <>
          <SectionHeader title={ct.inviteSection} style={styles.sectionHeader} />
          <Card style={styles.codeCard}>
            <StatusBadge
              label={`${t[data.status as keyof typeof t] || data.status}${data.status === "active" && expired ? ` (${t.expired})` : ""}`}
              tone={data.status === "active" && expired ? "neutral" : STATUS_TONE[data.status] ?? "neutral"}
            />
            {showCode && <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${ct.copyCode} ${data.code}`}
              style={({pressed}) => [styles.codeBox, pressed && styles.codeBoxPressed]}
              onPress={() => { void Clipboard.setStringAsync(data.code).then(() => setCopiedCode(data.code)); }}
            >
              <Text selectable style={styles.code}>{data.code}</Text>
              <Text style={styles.codeHint}>{copiedCode === data.code ? ct.copied : ct.copyCode}</Text>
            </Pressable>}
            <Text style={styles.meta}>{t.expires}: {data.expiresAt ? new Date(data.expiresAt).toLocaleString() : "—"}</Text>
            <Text style={styles.helper}>{t.validity}</Text>
          </Card>

          {data.status === "pending" && <>
            <SectionHeader title={ct.pendingSection} style={styles.sectionHeader} />
            <Card style={styles.stack}>
              <Text style={styles.meta}>{t.applicant}</Text>
              <View style={styles.identityRow}>
                <UserAvatar uri={data.applicant?.avatarUrl} name={data.applicant?.displayName} uid={data.applicantUid} size={40} />
                <Text style={[styles.name, styles.identityText]} numberOfLines={1}>{applicantName}</Text>
              </View>
              <Text style={styles.meta}>{t.role}: {data.role === "family" ? t.secondary : t.caregiver}</Text>
              <View style={styles.buttonRow}>
                <Button label={t.approve} icon="checkmark" disabled={busy} onPress={() => confirm("approve")} style={styles.flexButton} />
                <Button label={t.reject} variant="secondary" disabled={busy} onPress={() => confirm("reject")} style={styles.flexButton} />
              </View>
            </Card>
          </>}

          <SectionHeader title={ct.dangerSection} style={styles.sectionHeader} />
          <Card style={styles.stack}>
            <Text style={styles.helper}>{t.warning}</Text>
            <View style={styles.buttonRow}>
              <Button label={t.regenerate} icon="refresh" variant="secondary" disabled={busy} onPress={() => confirm("regenerate")} style={styles.flexButton} />
              <Button label={t.revoke} icon="close-circle-outline" variant="secondary" disabled={busy} onPress={() => confirm("revoke")} style={styles.flexButton} />
            </View>
          </Card>

          <SectionHeader title={t.transferTitle} style={styles.sectionHeader} />
          <Card style={styles.stack}>
            <Text style={styles.helper}>{t.transferWarning}</Text>
            {!secondaryUids.length && <Text style={styles.meta}>{t.noSecondary}</Text>}
            {secondaryUids.map(targetUid => {
              const member = secondaryProfiles.get(targetUid);
              const name = member?.displayName || t.familyMember;
              return <View key={targetUid} style={styles.memberRow}>
                <View style={styles.identityRow}>
                  <UserAvatar uri={member?.avatarUrl} name={member?.displayName} uid={targetUid} size={40} />
                  <Text style={[styles.name, styles.identityText]} numberOfLines={1}>{name}</Text>
                </View>
                <Button label={t.transfer} variant="danger" disabled={busy} onPress={() => confirmTransfer(targetUid, name)} />
              </View>;
            })}
          </Card>
        </>}
        {!data && busy && <Text style={styles.helper}>{t.loading}</Text>}
      </>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.canvas},
  content: {padding: layout.screenPaddingX, gap: spacing.md, width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center"},
  overline: {...typography.overline},
  patientName: {...typography.title, marginTop: spacing.xs},
  roleRow: {flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md},
  roleLabel: {...typography.bodySmall},
  helper: {...typography.bodySmall},
  meta: {...typography.bodySmall, color: colors.textSecondary},
  errorCard: {backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft},
  errorText: {...typography.body, color: colors.danger},
  successCard: {backgroundColor: colors.successSoft, borderColor: colors.successSoft},
  successText: {...typography.body, color: colors.success},
  sectionHeader: {paddingTop: spacing.md, paddingBottom: 0},
  codeCard: {gap: spacing.md},
  codeBox: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
  },
  codeBoxPressed: {backgroundColor: colors.surface},
  code: {...typography.display, fontSize: 32, lineHeight: 40, letterSpacing: 6, color: colors.primary},
  codeHint: {...typography.caption, color: colors.primary, marginTop: spacing.xs},
  stack: {gap: spacing.sm},
  name: {...typography.body, color: colors.text, fontWeight: "600"},
  identityRow: {flexDirection: "row", alignItems: "center", gap: spacing.md},
  identityText: {flex: 1, minWidth: 0},
  buttonRow: {flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs},
  flexButton: {flexGrow: 1},
  memberRow: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
});
