import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { collection, getDocs, query, where, limit, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { useLanguage } from "@/src/store/LanguageContext";
import { invitationCopy } from "./invitationCopy";
import { useActiveCareTarget } from "./useActiveCareTarget";
import { router } from "expo-router";
import { Button, Card, SectionHeader, StatusBadge, type StatusTone } from "@/src/ui/components";
import { colors, spacing, typography } from "@/src/ui/theme";

const STATUS_TONE: Record<string, StatusTone> = { approved: "success", pending: "warning", rejected: "danger" };
export default function JoinRequests() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = invitationCopy[language];
  const { setActivePatientId } = useActiveCareTarget();
  const [state, setState] = useState<{uid: string; rows: {id: string; patientId: string; status: string; createdAt: string}[]}>();
  const [error, setError] = useState(false);
  const [accountScope, setAccountScope] = useState(user?.uid);
  if (accountScope !== user?.uid) { setAccountScope(user?.uid); setError(false); }
  useEffect(() => {
    if (!user) return;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    getDocs(query(collection(db, "users"), where("uid", "==", user.uid), limit(2))).then(profiles => {
      if (disposed) return;
      if (profiles.size !== 1) throw new Error("Profile unavailable");
      unsubscribe = onSnapshot(query(collection(profiles.docs[0].ref, "join_requests"), orderBy("createdAt", "desc"), limit(50)), snap => {
        setError(false);
        setState({uid: user.uid, rows: snap.docs.map(d => ({id: d.id, patientId: d.data().patientId, status: d.data().status,
          createdAt: d.data().createdAt?.toDate?.().toLocaleString() ?? ""}))});
      }, () => setError(true));
    }).catch(() => { if (!disposed) setError(true); });
    return () => { disposed = true; unsubscribe?.(); };
  }, [user]);
  const rows = state?.uid === user?.uid ? state?.rows || [] : [];
  // Nothing to show yet: keep the join screen focused on entering a code.
  if (!error && !rows.length) return null;
  return <View>
    <SectionHeader title={t.requests} style={styles.header} />
    {error && <Text style={styles.error} accessibilityRole="alert">{t.error}</Text>}
    {!!rows.length && <Card padding={0}>
      {rows.map((row, index) => <View key={row.id} style={[styles.row, index > 0 && styles.rowBorder]}>
        <StatusBadge label={t[row.status as keyof typeof t] || row.status} tone={STATUS_TONE[row.status] ?? "neutral"} />
        {!!row.createdAt && <Text style={styles.id}>{row.createdAt}</Text>}
        {row.status === "approved" && <Button label={t.enter} variant="secondary" icon="arrow-forward" onPress={async () => {
          try { await setActivePatientId(row.patientId); router.replace(user?.role === "caregiver" ? "/caregiver" : "/family"); } catch { setError(true); }
        }} />}
      </View>)}
    </Card>}
  </View>;
}

const styles = StyleSheet.create({
  header: { paddingTop: 0 },
  error: { ...typography.bodySmall, color: colors.danger, marginBottom: spacing.sm },
  row: { padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.surface },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  id: { ...typography.caption },
});
