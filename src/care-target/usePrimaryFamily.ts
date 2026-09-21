import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { primaryFamilyUid } from "./permissions";

export function usePrimaryFamily(patientId: string | null) {
  const { user } = useAuth();
  const uid = user?.uid;
  const key = `${uid}:${patientId}`;
  const [state, setState] = useState<{key: string; allowed: boolean}>();
  useEffect(() => {
    if (!uid || !patientId) return;
    return onSnapshot(doc(db, "patients", patientId), snap => {
      setState({key, allowed: snap.exists() && primaryFamilyUid(snap.data()) === uid});
    }, () => setState({key, allowed: false}));
  }, [uid, patientId, key]);
  return state?.key === key && state.allowed;
}
