// src/agency/useAgencyCaregivers.ts

import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";

export type AgencyCaregiver = {
  id: string;

  caregiverUid: string;
  caregiverEmail: string;

  agencyUid: string;
  agencyInviteCode: string;

  createdAt?: Timestamp | null;

  // caregiver_profiles
  displayName: string;
  phone: string;
  avatarUrl: string;
};

export function useAgencyCaregivers() {
  const { user } = useAuth();

  const [caregivers, setCaregivers] = useState<AgencyCaregiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== "agency") {
      setCaregivers([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const membershipsQuery = query(
      collection(db, "agency_memberships"),
      where("agencyUid", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      membershipsQuery,

      async (snapshot) => {
        try {
          const items = await Promise.all(
            snapshot.docs.map(async (membershipDoc) => {
              const membershipData = membershipDoc.data();

              const caregiverUid = String(
                membershipData.caregiverUid ?? ""
              );

              let displayName = "";
              let phone = "";
              let avatarUrl = "";

              // 嘗試讀取看護自己填寫的基本資料
              try {
                const profileRef = doc(
                  db,
                  "caregiver_profiles",
                  caregiverUid
                );

                const profileSnap = await getDoc(profileRef);

                if (profileSnap.exists()) {
                  const profile = profileSnap.data();

                  displayName = String(
                    profile.displayName ?? ""
                  );

                  phone = String(
                    profile.phone ?? ""
                  );

                  avatarUrl = String(
                    profile.avatarUrl ?? ""
                  );
                }
              } catch (profileError) {
                console.log(
                  "[agency caregivers] profile read failed:",
                  caregiverUid,
                  profileError
                );
              }

              return {
                id: membershipDoc.id,

                caregiverUid,
                caregiverEmail: String(
                  membershipData.caregiverEmail ?? ""
                ),

                agencyUid: String(
                  membershipData.agencyUid ?? ""
                ),

                agencyInviteCode: String(
                  membershipData.agencyInviteCode ?? ""
                ),

                createdAt:
                  membershipData.createdAt ?? null,

                displayName,
                phone,
                avatarUrl,
              } as AgencyCaregiver;
            })
          );

          // 最近綁定的看護放前面
          items.sort((a, b) => {
            const aTime =
              a.createdAt?.toMillis?.() ?? 0;

            const bTime =
              b.createdAt?.toMillis?.() ?? 0;

            return bTime - aTime;
          });

          setCaregivers(items);
          setLoading(false);
        } catch (err: any) {
          console.log(
            "[agency caregivers] profile loading failed:",
            err
          );

          setError(
            err?.message ?? "旗下看護資料讀取失敗"
          );

          setLoading(false);
        }
      },

      (err) => {
        console.log(
          "[agency caregivers] snapshot error:",
          err
        );

        setError(
          err?.message ?? "旗下看護資料讀取失敗"
        );

        setCaregivers([]);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user?.uid, user?.role]);

  return {
    caregivers,
    caregiverCount: caregivers.length,
    loading,
    error,
  };
}