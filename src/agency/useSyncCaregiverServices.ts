import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import { collection, doc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { useEffect } from "react";

/** Retains history on unlink; never deletes service summaries from the App. */
export function useSyncCaregiverServices() {
  const { user } = useAuth();
  const uid = user?.uid;
  const role = user?.role;
  useEffect(() => {
    if (!uid || role !== "caregiver") return;
    let cancelled = false;
    let stopPatients: (() => void) | undefined;
    let queue = Promise.resolve();
    const fail = () => console.warn("Service summary sync failed; will retry on the next snapshot.");
    const stopMembership = onSnapshot(doc(db, "agency_memberships", uid), membership => {
      stopPatients?.();
      if (!membership.exists() || cancelled) return;
      stopPatients = onSnapshot(query(collection(db, "patients"), where("caregivers", "array-contains", uid)), snapshot => {
        // Serialize snapshots so an older callback cannot undo a newer state.
        queue = queue.then(async () => {
          if (cancelled) return;
          const current = new Map(snapshot.docs.map(patient => [patient.id, patient.data()]));
          const summaries = collection(db, "caregiver_service_summaries", uid, "patients");
          const existing = await getDocs(summaries);
          const ids = new Set([...current.keys(), ...existing.docs.map(item => item.id)]);
          for (const patientId of ids) {
            if (cancelled) return;
            const ref = doc(summaries, patientId);
            await runTransaction(db, async tx => {
              const previous = await tx.get(ref);
              if (cancelled) return;
              const patient = current.get(patientId);
              if (patient) {
                tx.set(ref, {
                  caregiverUid: uid, patientId,
                  patientName: String(patient.name ?? "未命名照護對象").slice(0, 120),
                  active: true,
                  createdAt: previous.exists() ? previous.data().createdAt : serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              } else if (previous.exists() && previous.data().active !== false) {
                tx.update(ref, { active: false, updatedAt: serverTimestamp() });
              }
            });
          }
        }).catch(fail);
      }, fail);
    }, fail);
    return () => { cancelled = true; stopMembership(); stopPatients?.(); };
  }, [uid, role]);
}
