import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect } from "react";

export function useSyncCaregiverServices() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || user.role !== "caregiver") {
      return;
    }

    let cancelled = false;
    let unsubscribePatients: (() => void) | null = null;

    async function startSync() {
      // 沒綁仲介就不用建立仲介摘要
      const membershipRef = doc(
        db,
        "agency_memberships",
        user!.uid
      );

      const membershipSnap = await getDoc(membershipRef);

      if (!membershipSnap.exists() || cancelled) {
        return;
      }

      const patientsQuery = query(
        collection(db, "patients"),
        where("caregivers", "array-contains", user!.uid)
      );

      unsubscribePatients = onSnapshot(
        patientsQuery,
        async (snapshot) => {
          try {
            const currentPatientIds = new Set(
              snapshot.docs.map((d) => d.id)
            );

            // 建立 / 更新目前照護對象
            await Promise.all(
              snapshot.docs.map(async (patientDoc) => {
                const patient = patientDoc.data();

                const summaryRef = doc(
                  db,
                  "caregiver_service_summaries",
                  user!.uid,
                  "patients",
                  patientDoc.id
                );

                const summarySnap =
                  await getDoc(summaryRef);

                if (summarySnap.exists()) {
                  await updateDoc(summaryRef, {
                    patientName: String(
                      patient.name ?? "未命名照護對象"
                    ),
                    updatedAt: serverTimestamp(),
                  });
                } else {
                  await setDoc(summaryRef, {
                    caregiverUid: user!.uid,
                    patientId: patientDoc.id,
                    patientName: String(
                      patient.name ?? "未命名照護對象"
                    ),
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                }
              })
            );

            // 清掉已經不再照護的舊摘要
            const summaryCollection = collection(
              db,
              "caregiver_service_summaries",
              user!.uid,
              "patients"
            );

            const existingSummaries =
              await getDocs(summaryCollection);

            await Promise.all(
              existingSummaries.docs
                .filter(
                  (d) => !currentPatientIds.has(d.id)
                )
                .map((d) => deleteDoc(d.ref))
            );
          } catch (error) {
            console.log(
              "[caregiver service sync] failed:",
              error
            );
          }
        }
      );
    }

    startSync();

    return () => {
      cancelled = true;

      if (unsubscribePatients) {
        unsubscribePatients();
      }
    };
  }, [user?.uid, user?.role]);
}