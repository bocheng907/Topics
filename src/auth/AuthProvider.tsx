import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/firebase/firebaseConfig";

export type Role = "caregiver" | "family";

export type AuthUser = {
  uid: string;
  email: string;
  role: Role;
};

type RegisterExtra = {
  emergencyPhone1?: string;
  emergencyPhone2?: string;
};

type AuthValue = {
  ready: boolean;
  user: AuthUser | null;
  register: (
    email: string,
    password: string,
    role: Role,
    extra?: RegisterExtra
  ) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (!fbUser) {
          setUser(null);
          setReady(true);
          return;
        }

        const q = query(collection(db, "users"), where("uid", "==", fbUser.uid));
        const snap = await getDocs(q);

        if (!snap.empty) {
          const data = snap.docs[0].data() as any;

          setUser({
            uid: fbUser.uid,
            email: fbUser.email ?? "",
            role: (data.role as Role) ?? "family",
          });
        } else {
          const fallbackRole: Role = "family";

          const now = new Date();
          const yyyy = now.getFullYear();
          const mm = String(now.getMonth() + 1).padStart(2, "0");
          const dd = String(now.getDate()).padStart(2, "0");
          const hh = String(now.getHours()).padStart(2, "0");
          const min = String(now.getMinutes()).padStart(2, "0");
          const ss = String(now.getSeconds()).padStart(2, "0");

          const timeString = `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
          const shortId = fbUser.uid.slice(-4);
          const customDocId = `${timeString}_user_${shortId}`;

          const payload = {
            uid: fbUser.uid,
            email: fbUser.email ?? "",
            role: fallbackRole,
            createdAt: serverTimestamp(),
            activePatientId: "",
            emergencyPhone1: "",
            emergencyPhone2: "",
          };

          const docRef = doc(db, "users", customDocId);
          await setDoc(docRef, payload);

          setUser({
            uid: fbUser.uid,
            email: fbUser.email ?? "",
            role: fallbackRole,
          });
        }
      } catch (e) {
        console.log("[AuthProvider] onAuthStateChanged error:", e);
        setUser(null);
      } finally {
        setReady(true);
      }
    });

    return unsub;
  }, []);

  const value = useMemo<AuthValue>(() => {
    async function register(
      email: string,
      password: string,
      role: Role,
      extra?: RegisterExtra
    ) {
      email = email.trim().toLowerCase();

      if (!email || !password) {
        throw new Error("Email / 密碼不可為空");
      }

      if (password.length < 6) {
        throw new Error("密碼至少 6 碼");
      }

      const emergencyPhone1 = (extra?.emergencyPhone1 ?? "").trim();
      const emergencyPhone2 = (extra?.emergencyPhone2 ?? "").trim();

      if (role === "family") {
        if (!emergencyPhone1 || !emergencyPhone2) {
          throw new Error("家屬帳號請填寫 2 組緊急聯絡電話");
        }
      }

      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const fbUser = cred.user;

        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const hh = String(now.getHours()).padStart(2, "0");
        const min = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");

        const timeString = `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
        const shortId = fbUser.uid.slice(-4);
        const customDocId = `${timeString}_user_${shortId}`;

        const payload = {
          uid: fbUser.uid,
          email,
          role,
          createdAt: serverTimestamp(),
          activePatientId: "",
          emergencyPhone1: role === "family" ? emergencyPhone1 : "",
          emergencyPhone2: role === "family" ? emergencyPhone2 : "",
        };

        const docRef = doc(db, "users", customDocId);
        await setDoc(docRef, payload);

        setUser({
          uid: fbUser.uid,
          email,
          role,
        });
      } catch (e: any) {
        console.log("[register] error code =", e?.code);
        console.log("[register] error message =", e?.message);
        throw e;
      }
    }

    async function login(email: string, password: string) {
      email = email.trim().toLowerCase();
      await signInWithEmailAndPassword(auth, email, password);
    }

    async function logout() {
      await signOut(auth);
      setUser(null);
    }

    return {
      ready,
      user,
      register,
      login,
      logout,
    };
  }, [ready, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}