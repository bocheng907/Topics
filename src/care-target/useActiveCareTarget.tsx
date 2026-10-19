import {
  createContext,
  useCallback,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  doc,
  getDocFromServer,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";

export type CareTarget = {
  id: string;
  patientsId?: string;
  name: string;
  notes?: string;
  inviteCode?: string;
  createdAt: number;
  updatedAt?: number;
};

const activeKey = (uid: string) => `careapp_activePatient_v1:${uid}`;

type ActiveCareTargetContextValue = {
  ready: boolean;
  hydrating: boolean;
  activePatientId: string | null;
  activePatient: CareTarget | null;
  linkedCareTargets: CareTarget[];
  setActivePatientId: (id: string) => Promise<void>;
  clearActivePatient: () => Promise<void>;
  forgetCareTarget: (id: string) => Promise<void>;
};

const ActiveCareTargetContext = createContext<ActiveCareTargetContextValue | null>(null);

export function ActiveCareTargetProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const uid = user?.uid;
  const role = user?.role;

  const [hydrating, setHydrating] = useState(true);
  const [activePatientId, setActiveId] = useState<string | null>(null);

  const [targets, setTargets] = useState<CareTarget[]>([]);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const scope = `${ready}/${user?.uid}/${user?.role}`;
  const [previousScope, setPreviousScope] = useState<string | null>(null);
  if (previousScope !== scope) {
    setPreviousScope(scope); setActiveId(null); setTargets([]); setLinkedIds([]);
    setHydrating(Boolean(ready && uid && role && role !== "agency"));
  }

  useEffect(() => {
    if (!ready || !uid || !role || role === "agency") return;

    let cancelled = false;

    (async () => {
      try {

        const field =
          role === "family"
            ? "families"
            : "caregivers";

        const [snap, activeRaw] = await Promise.all([
          getDocs(
            query(
              collection(db, "patients"),
              where(field, "array-contains", uid)
            )
          ),
          AsyncStorage.getItem(activeKey(uid)),
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
            patientsId: data.patientsId ?? "",
            name: data.name ?? "",
            notes: data.notes ?? data.note ?? "",
            inviteCode: data.inviteCode ?? "",
            createdAt,
            updatedAt,
          };
        });

        const ids = fetchedTargets.map((t) => t.id);

        setTargets(fetchedTargets);
        setLinkedIds(ids);

        let nextActiveId =
          typeof activeRaw === "string" && activeRaw.trim() !== ""
            ? activeRaw
            : null;

        if ((!nextActiveId || !ids.includes(nextActiveId)) && ids.length > 0) {
          nextActiveId = ids[0];
          await AsyncStorage.setItem(activeKey(uid), nextActiveId);

          try {
            const userSnap = await getDocs(
              query(collection(db, "users"), where("uid", "==", uid))
            );

            if (!userSnap.empty) {
              await updateDoc(doc(db, "users", userSnap.docs[0].id), {
                activePatientId: nextActiveId,
              });
            }
          } catch (e) {
            console.log("update activePatientId failed:", e);
          }
        }

        if (ids.length === 0) {
          nextActiveId = null;
          await AsyncStorage.removeItem(activeKey(uid));

          try {
            const userSnap = await getDocs(
              query(collection(db, "users"), where("uid", "==", uid))
            );

            if (!userSnap.empty) {
              await updateDoc(doc(db, "users", userSnap.docs[0].id), {
                activePatientId: "",
              });
            }
          } catch (e) {
            console.log("clear activePatientId failed:", e);
          }
        }

        if (!cancelled) {
          setActiveId(nextActiveId);
        }
      } catch (err) {
        console.log("useActiveCareTarget load failed:", err);

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
  }, [ready, uid, role]);

  const linkedCareTargets = useMemo(() => {
    const setIds = new Set(linkedIds);
    return targets.filter((t) => setIds.has(t.id));
  }, [targets, linkedIds]);

  const activePatient = useMemo(() => {
    if (!activePatientId) return null;
    return targets.find((t) => t.id === activePatientId) ?? null;
  }, [targets, activePatientId]);

  const setActivePatientId = useCallback(async (id: string) => {
    if (!user || user.role === "agency") return;
    if (!id || id.includes("/")) throw new Error("Invalid patient");
    const uid = user.uid;
    const snap = await getDocFromServer(doc(db, "patients", id));
    if (!snap.exists()) throw new Error("Patient no longer exists");
    const data = snap.data();
    const field = user.role === "family" ? "families" : "caregivers";
    if (!Array.isArray(data[field]) || !data[field].includes(uid)) throw new Error("Membership unavailable");
    const profiles = await getDocs(query(collection(db, "users"), where("uid", "==", uid)));
    if (profiles.size !== 1) throw new Error("Profile unavailable");
    if (auth.currentUser?.uid !== uid) throw new Error("Account changed");
    await updateDoc(profiles.docs[0].ref, { activePatientId: id });
    if (auth.currentUser?.uid !== uid) throw new Error("Account changed");
    await AsyncStorage.setItem(activeKey(uid), id);
    if (auth.currentUser?.uid !== uid) throw new Error("Account changed");
    const createdAt = data.createdAt?.toMillis?.() ?? 0;
    const target: CareTarget = {id, patientsId: data.patientsId ?? "", name: data.name ?? "",
      notes: data.notes ?? data.note ?? "", inviteCode: data.inviteCode ?? "", createdAt,
      updatedAt: data.updatedAt?.toMillis?.() ?? createdAt};
    setTargets(prev => [...prev.filter(item => item.id !== id), target]);
    setLinkedIds(prev => prev.includes(id) ? prev : [...prev, id]);
    setActiveId(id);
  }, [user]);

  const forgetCareTarget = useCallback(async (id: string) => {
    if (!user) return;
    // The callable has already removed membership and cleared the server profile.
    // Clear memory before storage so a storage failure cannot retain visible data.
    setTargets(prev => prev.filter(target => target.id !== id));
    setLinkedIds(prev => prev.filter(linked => linked !== id));
    if (activePatientId === id) {
      setActiveId(null);
      await AsyncStorage.removeItem(activeKey(user.uid));
    }
  }, [user, activePatientId]);

  const clearActivePatient = useCallback(async () => {
    if (!user || user.role === "agency") return;

    await AsyncStorage.removeItem(activeKey(user.uid));
    setActiveId(null);

    try {
      const userSnap = await getDocs(
        query(collection(db, "users"), where("uid", "==", user.uid))
      );

      if (!userSnap.empty) {
        await updateDoc(doc(db, "users", userSnap.docs[0].id), {
          activePatientId: "",
        });
      }
    } catch (e) {
      console.log("clear activePatientId failed:", e);
    }
  }, [user]);

  const value = useMemo<ActiveCareTargetContextValue>(() => ({
    ready: ready && !hydrating,
    hydrating,
    activePatientId,
    activePatient,
    linkedCareTargets,
    setActivePatientId,
    forgetCareTarget,
    clearActivePatient,
  }), [ready, hydrating, activePatientId, activePatient, linkedCareTargets, setActivePatientId, forgetCareTarget, clearActivePatient]);

  return (
    <ActiveCareTargetContext.Provider value={value}>
      {children}
    </ActiveCareTargetContext.Provider>
  );
}

export function useActiveCareTarget() {
  const value = useContext(ActiveCareTargetContext);
  if (!value) {
    throw new Error("useActiveCareTarget must be used within ActiveCareTargetProvider");
  }
  return value;
}
