import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "@/firebase/firebaseConfig";
import { addUserRoleToBatch, syncUserRole } from "./userRole";
import { reportSession, signOut } from "./auditSession";
import { isValidRegistrationPassword } from "./passwordPolicy";
import { assertPrivacyConsent, PRIVACY_POLICY_VERSION, type PrivacyConsent } from "@/src/privacy/consent";

export type Role =
  | "caregiver"
  | "family"
  | "agency";

export type AuthUser = {
  uid: string;
  email: string;
  role: Role;
  accountStatus: "active" | "pending_deletion";
  deletionScheduledFor?: Date;
};

type RegisterExtra = {
  privacyConsent?: PrivacyConsent;
  displayName?: string;
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
  const registrationInProgress = useRef(false);
  const authEpoch = useRef(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      const epoch = ++authEpoch.current;
      if (registrationInProgress.current) return;
      try {
        if (!fbUser) {
          setUser(null);
          setReady(true);
          return;
        }

        const q = query(collection(db, "users"), where("uid", "==", fbUser.uid));
        const snap = await getDocs(q);
        if (epoch !== authEpoch.current || registrationInProgress.current) return;

        if (!snap.empty) {
          const data = snap.docs[0].data() as any;
          const resolvedRole = (data.role as Role) ?? "family";

          // 補寫 user_roles/{uid}，讓 Security Rules 能判斷角色。
          // 既有帳號沒有這份文件，重新登入一次就會自動補上。
          // 先等它寫完再進入畫面，避免仲介邀請碼、看護綁定、社群等
          // 依賴角色的規則在第一次登入時因為還沒有 user_roles 而失敗。
          try {
            await syncUserRole(fbUser.uid, resolvedRole, snap.docs[0].id);
          } catch (error) {
            console.log("[AuthProvider] syncUserRole failed:", error);
          }
          if (epoch !== authEpoch.current || registrationInProgress.current) return;

          setUser({
            uid: fbUser.uid,
            email: fbUser.email ?? "",
            role: resolvedRole,
            accountStatus: data.accountStatus === "pending_deletion" ?
              "pending_deletion" : "active",
            deletionScheduledFor: data.deletionScheduledFor?.toDate?.(),
          });
        } else {
          // Never fabricate a role or policy agreement during login.
          // An interrupted registration can be completed explicitly on the registration page.
          setUser(null);
        }
      } catch (e) {
        if (epoch !== authEpoch.current || registrationInProgress.current) return;
        console.log("[AuthProvider] onAuthStateChanged error:", e);
        setUser(null);
      } finally {
        if (epoch === authEpoch.current && !registrationInProgress.current) setReady(true);
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
      assertPrivacyConsent(extra?.privacyConsent);
      if (registrationInProgress.current) throw new Error("Registration already in progress");

      if (!email || !password) {
        throw new Error("Email / 密碼不可為空");
      }

      if (!isValidRegistrationPassword(password)) {
        throw Object.assign(new Error("Password must contain at least 8 characters, a lowercase letter and a number."), {
          code: "auth/weak-password",
        });
      }

      const displayName = (extra?.displayName ?? "").normalize("NFKC").trim();
      // Display name is optional at registration (can be set later in Account Settings).
      if (displayName.length > 120) {
        throw new Error("名稱最多 120 個字元");
      }

      const emergencyPhone1 = (extra?.emergencyPhone1 ?? "").trim();
      const emergencyPhone2 = (extra?.emergencyPhone2 ?? "").trim();

      if (role === "family") {
        if (!emergencyPhone1 || !emergencyPhone2) {
          throw new Error("家屬帳號請填寫 2 組緊急聯絡電話");
        }
      }

      registrationInProgress.current = true;
      authEpoch.current++;
      try {
        let fbUser = auth.currentUser;
        if (fbUser && fbUser.email?.toLowerCase() === email) {
          // Retry a profile write only after re-verifying this exact account.
          await reauthenticateWithCredential(fbUser, EmailAuthProvider.credential(email, password));
          const existing = await getDocs(query(collection(db, "users"), where("uid", "==", fbUser.uid)));
          if (!existing.empty) throw Object.assign(new Error("Account already registered"), { code: "auth/email-already-in-use" });
        } else {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          fbUser = cred.user;
        }

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
          displayName,
          avatarUrl: "",
          privacyConsent: {
            accepted: true,
            version: PRIVACY_POLICY_VERSION,
            acceptedAt: serverTimestamp(),
          },
        };

        // users 文件與角色對照表 user_roles/{uid} 必須同一個 batch 寫入：
        // Security Rules 用 getAfter 互相核對兩邊的 role，也藉此保證一個帳號只有一份 users 文件
        const batch = writeBatch(db);
        batch.set(doc(db, "users", customDocId), payload);
        addUserRoleToBatch(batch, fbUser.uid, role, customDocId);
        await batch.commit();

        setUser({
          uid: fbUser.uid,
          email,
          role,
          accountStatus: "active",
        });
      } catch (e: any) {
        console.log("[register] error code =", e?.code);
        console.log("[register] error message =", e?.message);
        throw e;
      } finally {
        registrationInProgress.current = false;
        authEpoch.current++;
        setReady(true);
      }
    }

    async function login(email: string, password: string) {
      email = email.trim().toLowerCase();
      await signInWithEmailAndPassword(auth, email, password);
      const profile = await getDocs(query(collection(db, "users"), where("uid", "==", auth.currentUser!.uid)));
      if (profile.empty) throw new Error("帳號資料尚未完成，請前往註冊頁，使用相同帳號密碼並閱讀及同意隱私權政策以完成註冊。");
      await reportSession("login");
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
