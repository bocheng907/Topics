import React, { useEffect, useState } from "react";
import { Text, View, Pressable } from "react-native";
import { useGlobalSearchParams, useSegments, router } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "./useActiveCareTarget";
import { canCreatePrescriptionForPatient } from "./permissions";
import { useLanguage } from "@/src/store/LanguageContext";
import { invitationCopy } from "./invitationCopy";

export default function PrescriptionWriteGuard({ children }: { children: React.ReactNode }) {
  const segments = useSegments() as string[];
  const params = useGlobalSearchParams<{ id?: string; prescriptionId?: string }>();
  const { user } = useAuth();
  const uid = user?.uid;
  const { language } = useLanguage();
  const t = invitationCopy[language];
  const { activePatientId } = useActiveCareTarget();
  const guarded = ["edit", "camera", "result", "scan-result"].includes(segments[segments.length - 1] || "");
  const id = params.id || params.prescriptionId;
  const creating = !id && ["camera", "result", "scan-result"].includes(segments[segments.length - 1] || "");
  const key = `${uid}:${activePatientId}:${id}:${guarded}:${creating}`;
  const [permission, setPermission] = useState<{ key: string; allowed: boolean } | null>(null);
  useEffect(() => {
    if (!guarded || !uid) return;
    let patientUnsubscribe: (() => void) | undefined;
    const deny = () => setPermission({ key, allowed: false });
    const watchPatient = (patientId: string) => {
      patientUnsubscribe?.();
      deny();
      if (!patientId || typeof patientId !== "string") return;
      patientUnsubscribe = onSnapshot(doc(db, "patients", patientId), snap => {
        if (!snap.exists()) {
          deny();
          return;
        }
        const data = snap.data() as Record<string, any>;
        const canManage =
          (Array.isArray(data.families) && data.families.includes(uid)) ||
          (Array.isArray(data.caregivers) && data.caregivers.includes(uid));
        setPermission({ key, allowed: creating
          ? canCreatePrescriptionForPatient(data, uid)
          : canManage });
      }, deny);
    };
    const unsubscribe = typeof id === "string" && id
      ? onSnapshot(doc(db, "prescriptions", id), snap => {
        if (snap.exists()) watchPatient(snap.data().patientId); else deny();
      }, deny) : undefined;
    if (!id) watchPatient(activePatientId || "");
    return () => { unsubscribe?.(); patientUnsubscribe?.(); };
  }, [key, guarded, uid, id, activePatientId, creating]);
  if (!guarded) return <>{children}</>;
  if (permission?.key === key && permission.allowed) return <>{children}</>;
  return <View style={{ padding: 28, paddingTop: 100, gap: 20 }}>
    <Text>{permission?.key === key ? t.primaryOnly : t.loading}</Text>
    <Pressable onPress={() => router.replace(user?.role === "caregiver" ? "/caregiver/list" : "/family/list")}>
      <Text>{t.back}</Text>
    </Pressable>
  </View>;
}
