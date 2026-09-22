import React, { useEffect, useState } from "react";
import { Text, View, Pressable } from "react-native";
import { collection, getDocs, query, where, limit, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { useLanguage } from "@/src/store/LanguageContext";
import { invitationCopy } from "./invitationCopy";
import { useActiveCareTarget } from "./useActiveCareTarget";
import { router } from "expo-router";
export default function JoinRequests() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = invitationCopy[language];
  const { setActivePatientId } = useActiveCareTarget();
  const [state, setState] = useState<{uid: string; rows: {id: string; patientId: string; status: string}[]}>();
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!user) return;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    setError(false);
    getDocs(query(collection(db, "users"), where("uid", "==", user.uid), limit(2))).then(profiles => {
      if (disposed) return;
      if (profiles.size !== 1) throw new Error("Profile unavailable");
      unsubscribe = onSnapshot(query(collection(profiles.docs[0].ref, "join_requests"), orderBy("createdAt", "desc"), limit(50)), snap => {
        setState({uid: user.uid, rows: snap.docs.map(d => ({id: d.id, patientId: d.data().patientId, status: d.data().status}))});
      }, () => setError(true));
    }).catch(() => { if (!disposed) setError(true); });
    return () => { disposed = true; unsubscribe?.(); };
  }, [user]);
  const rows = state?.uid === user?.uid ? state?.rows || [] : [];
  return <View style={{ gap: 12 }}><Text style={{ fontWeight: "700" }}>{t.requests}</Text>
    {error && <Text>{t.error}</Text>}
    {!rows.length && <Text>{t.empty}</Text>}
    {rows.map(row => <View key={row.id} style={{ padding: 12, borderWidth: 1, borderColor: "#ddd", gap: 8 }}>
      <Text selectable>{row.id}</Text><Text>{t[row.status as keyof typeof t] || row.status}</Text>
      {row.status === "approved" && <Pressable onPress={async () => {
        try { await setActivePatientId(row.patientId); router.replace(user?.role === "caregiver" ? "/caregiver" : "/family"); } catch { setError(true); }
      }}><Text style={{ color: "#007AFF" }}>{t.enter}</Text></Pressable>}
    </View>)}
  </View>;
}
