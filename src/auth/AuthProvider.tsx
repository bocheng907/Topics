import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/firebase/firebaseConfig";

export type Role = "caregiver" | "family";

export type AuthUser = {
  uid: string;
  email: string;
  role: Role;
};

type AuthValue = {
  ready: boolean;
  user: AuthUser | null;

  register: (email: string, password: string, role: Role) => Promise<void>;
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

        const userRef = doc(db, "users", fbUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data() as any;

          setUser({
            uid: fbUser.uid,
            email: fbUser.email ?? "",
            role: (data.role as Role) ?? "family",
          });
        } else {
          // 如果 Firebase Auth 有帳號，但 Firestore users 還沒有文件
          const fallbackRole: Role = "family";

          await setDoc(userRef, {
            role: fallbackRole,
            createdAt: serverTimestamp(),
            activePatientId: "",
          });

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
    async function register(email: string, password: string, role: Role) {
      email = email.trim().toLowerCase();

      if (!email || !password) {
        throw new Error("Email / 密碼不可為空");
      }

      if (password.length < 6) {
        throw new Error("密碼至少 6 碼");
      }

      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const fbUser = cred.user;

        await setDoc(doc(db, "users", fbUser.uid), {
          role,
          createdAt: serverTimestamp(),
          activePatientId: "",
        });

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
      // user 狀態交給 onAuthStateChanged 處理
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