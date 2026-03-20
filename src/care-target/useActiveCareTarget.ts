import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";

export type CareTarget = {
  id: string;
  name: string;
  note?: string;
  inviteCode?: string;
  createdAt: number;
  updatedAt?: number;
};

const activeKey = (uid: string) => `careapp_activeCareTarget_v1:${uid}`;

export function useActiveCareTarget() {
  const { user, ready } = useAuth();

  const [hydrating, setHydrating] = useState(true);
  const [activeCareTargetId, setActiveId] = useState<string | null>(null);

  const [targets, setTargets] = useState<CareTarget[]>([]);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!ready) return;

    if (!user) {
      setActiveId(null);
      setTargets([]);
      setLinkedIds([]);
      setHydrating(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setHydrating(true);

        const field = user.role === "family" ? "families" : "caregivers";

        const [snap, activeRaw] = await Promise.all([
          getDocs(
            query(
              collection(db, "patients"),
              where(field, "array-contains", user.uid)
            )
          ),
          AsyncStorage.getItem(activeKey(user.uid)),
        ]);

        if (cancelled) return;

        const fetchedTargets: CareTarget[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as any;

          let createdAt = Date.now();
          if (data.createdAt?.toMillis) {
            createdAt = data.createdAt.toMillis();
          } else if (typeof data.createdAt === "number") {
            createdAt = data.createdAt;
          }

          let updatedAt = createdAt;
          if (data.updatedAt?.toMillis) {
            updatedAt = data.updatedAt.toMillis();
          } else if (typeof data.updatedAt === "number") {
            updatedAt = data.updatedAt;
          }

          return {
            id: docSnap.id,
            name: data.name ?? "",
            note: data.note ?? data.notes ?? "",
            inviteCode: data.inviteCode ?? "",
            createdAt,
            updatedAt,
          };
        });

        const ids = fetchedTargets.map((t) => t.id);

        setTargets(fetchedTargets);
        setLinkedIds(ids);

        let activeId = activeRaw || null;

        // active 不存在、或 active 已經不是自己有權限的 patients，就自動修正
        if ((!activeId || !ids.includes(activeId)) && ids.length > 0) {
          activeId = ids[0];
          await AsyncStorage.setItem(activeKey(user.uid), activeId);

          try {
            await updateDoc(doc(db, "users", user.uid), {
              activeCareTargetId: activeId,
            });
            console.log("[activeCareTarget] auto-synced to firestore:", activeId);
          } catch (e) {
            console.log("[activeCareTarget] auto-sync firestore failed:", e);
          }
        }

        // 如果完全沒有可選長輩，就清掉 active
        if (ids.length === 0) {
          activeId = null;
          await AsyncStorage.removeItem(activeKey(user.uid));

          try {
            await updateDoc(doc(db, "users", user.uid), {
              activeCareTargetId: "",
            });
            console.log("[activeCareTarget] cleared in firestore");
          } catch (e) {
            console.log("[activeCareTarget] clear firestore failed:", e);
          }
        }

        if (!cancelled) {
          setActiveId(activeId);
        }
      } catch (err) {
        console.log("useActiveCareTarget firestore error:", err);
        if (!cancelled) {
          setTargets([]);
          setLinkedIds([]);
          setActiveId(null);
        }
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, user?.uid, user?.role]);

  const linkedCareTargets = useMemo(() => {
    const setIds = new Set(linkedIds);
    return targets.filter((t) => setIds.has(t.id));
  }, [targets, linkedIds]);

  const activeCareTarget = useMemo(() => {
    if (!activeCareTargetId) return null;
    return targets.find((t) => t.id === activeCareTargetId) ?? null;
  }, [targets, activeCareTargetId]);

  async function setActiveCareTargetId(id: string) {
    if (!user) return;

    await AsyncStorage.setItem(activeKey(user.uid), id);
    setActiveId(id);

    try {
      await updateDoc(doc(db, "users", user.uid), {
        activeCareTargetId: id,
      });
      console.log("[activeCareTarget] synced to firestore:", id);
    } catch (e) {
      console.log("[activeCareTarget] firestore sync failed:", e);
    }
  }

  async function clearActiveCareTarget() {
    if (!user) return;

    await AsyncStorage.removeItem(activeKey(user.uid));
    setActiveId(null);

    try {
      await updateDoc(doc(db, "users", user.uid), {
        activeCareTargetId: "",
      });
      console.log("[activeCareTarget] cleared from firestore");
    } catch (e) {
      console.log("[activeCareTarget] firestore clear failed:", e);
    }
  }

  return {
    ready: !hydrating,
    hydrating,
    activeCareTargetId,
    activeCareTarget,
    linkedCareTargets,
    setActiveCareTargetId,
    clearActiveCareTarget,
  };
}