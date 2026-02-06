import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { auth } from "@/firebase/firebaseConfig";


/**
 * ✅ AuthProvider（本地版）
 * - 先用 AsyncStorage 做「註冊 / 登入 / session」
 * - 加上「長輩(照護對象)」：
 *   1) 可新增長輩（會產生 inviteCode）
 *   2) 可用 inviteCode 連結到長輩
 *   3) 同一個帳號可以連到多個長輩，並可切換 activeCareTargetId
 *
 * ⚠️ 未來串 Firebase：
 * - register/login 會換成 Firebase Auth
 * - careTargets / 連結關係 會搬到 Firestore
 * - 本地 AsyncStorage 只保留「登入 session（或 token）」或快取
 */

export type Role = "caregiver" | "family";
export type CareTargetId = string;

export type CareTarget = {
  id: CareTargetId;
  name: string;
  createdAt: number;
  inviteCode: string; // 用於家屬/看護輸入連結
};

export type AuthUser = {
  uid: string; // 本地先用 uid_時間戳，Firebase 之後換成真 uid
  email: string;
  role: Role;

  /** 這個帳號「已連結」的長輩清單 */
  linkedCareTargetIds: CareTargetId[];

  /** 目前正在看的長輩（登入後要先選定這個） */
  activeCareTargetId: CareTargetId | null;
};

type AuthValue = {
  ready: boolean;
  user: AuthUser | null;

  // ---- 基本帳號 ----
  register: (email: string, password: string, role: Role) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;

  // ---- 長輩 / 邀請碼 ----
  getMyCareTargets: () => Promise<CareTarget[]>;
  getActiveCareTarget: () => Promise<CareTarget | null>;
  setActiveCareTarget: (careTargetId: CareTargetId) => Promise<void>;

  createCareTarget: (name: string) => Promise<CareTarget>; // 新增長輩並自動連結
  linkByInviteCode: (inviteCode: string) => Promise<CareTarget>; // 輸入邀請碼連結
};

const AuthContext = createContext<AuthValue | null>(null);

// -------------------
// AsyncStorage keys
// -------------------
const KEY_USERS = "careapp_users_v2";
const KEY_SESSION = "careapp_session_v2";
const KEY_CARETARGETS = "careapp_care_targets_v1";

type StoredUser = AuthUser & { password: string };

function nowId(prefix: string) {
  return `${prefix}_${Date.now()}`;
}

function makeInviteCode() {
  // 簡單好輸入：6 碼大寫英數
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function migrateUser(u: any): AuthUser {
  const legacyCareTargetId = u?.careTargetId;
  const linked: CareTargetId[] =
    Array.isArray(u?.linkedCareTargetIds) ? u.linkedCareTargetIds : legacyCareTargetId ? [legacyCareTargetId] : [];
  const active: CareTargetId | null =
    typeof u?.activeCareTargetId === "string"
      ? u.activeCareTargetId
      : legacyCareTargetId
      ? legacyCareTargetId
      : null;

  return {
    uid: String(u?.uid ?? nowId("uid")),
    email: String(u?.email ?? ""),
    role: (u?.role as Role) ?? "family",
    linkedCareTargetIds: linked,
    activeCareTargetId: active,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  // -------------------
  // Startup: load session
  // -------------------
useEffect(() => {
  const unsub = onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      setUser(null);
      setReady(true);
      return;
    }

    // 🔑 關鍵：Firebase uid → 對應你原本的 AuthUser
    const users = await AsyncStorage.getItem(KEY_USERS);
    const list: StoredUser[] = users ? JSON.parse(users) : [];

    const found = list.find(u => u.uid === fbUser.uid || u.email === fbUser.email);

    if (found) {
      const { password: _pw, ...sessionUser } = found;
      setUser(sessionUser);
    } else {
      // Firebase 有帳，但本地還沒資料（第一次登入）
      const newUser: StoredUser = {
        uid: fbUser.uid,
        email: fbUser.email ?? "",
        password: "", // Firebase 管
        role: "family",
        linkedCareTargetIds: [],
        activeCareTargetId: null,
      };
      await AsyncStorage.setItem(KEY_USERS, JSON.stringify([newUser, ...list]));
      const { password: _pw, ...sessionUser } = newUser;
      setUser(sessionUser);
    }

    setReady(true);
  });

  return unsub;
}, []);


  // -------------------
  // Persist: session changes
  // -------------------
  useEffect(() => {
    if (!ready) return;
    (async () => {
      if (user) await AsyncStorage.setItem(KEY_SESSION, JSON.stringify(user));
      else await AsyncStorage.removeItem(KEY_SESSION);
    })();
  }, [user, ready]);

  const value = useMemo<AuthValue>(() => {
    // ---------- helpers ----------
    async function loadUsers(): Promise<StoredUser[]> {
      const raw = await AsyncStorage.getItem(KEY_USERS);
      const list = raw ? (JSON.parse(raw) as any[]) : [];
      return list.map((u) => {
        const migrated = migrateUser(u);
        return { ...migrated, password: String(u?.password ?? "") };
      });
    }

    async function saveUsers(users: StoredUser[]) {
      await AsyncStorage.setItem(KEY_USERS, JSON.stringify(users));
    }

    async function loadCareTargets(): Promise<CareTarget[]> {
      const raw = await AsyncStorage.getItem(KEY_CARETARGETS);
      return raw ? (JSON.parse(raw) as CareTarget[]) : [];
    }

    async function saveCareTargets(list: CareTarget[]) {
      await AsyncStorage.setItem(KEY_CARETARGETS, JSON.stringify(list));
    }

    function requireLogin() {
      if (!user) throw new Error("請先登入");
      return user;
    }

    // ---------- auth ----------
    async function register(email: string, password: string, role: Role) {
      email = email.trim().toLowerCase();
      if (!email || !password) throw new Error("Email / 密碼不可為空");
      if (password.length < 6) throw new Error("密碼至少 6 碼（先用最簡版規則）");

      const users = await loadUsers();
      const exists = users.some((u) => u.email === email);
      if (exists) throw new Error("此 Email 已註冊");

      const newUser: StoredUser = {
        uid: nowId("uid"),
        email,
        password,
        role,
        linkedCareTargetIds: [],
        activeCareTargetId: null,
      };

      await saveUsers([newUser, ...users]);

      // 註冊完直接登入（不帶 password）
      const { password: _pw, ...sessionUser } = newUser;
      setUser(sessionUser);
    }

    async function login(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email, password);
  // user 由 onAuthStateChanged 接手
}


    async function logout() {
  await signOut(auth);
  setUser(null);
}

    // ---------- care targets ----------
    async function getMyCareTargets(): Promise<CareTarget[]> {
      const u = requireLogin();
      const all = await loadCareTargets();
      return all.filter((ct) => u.linkedCareTargetIds.includes(ct.id));
    }

    async function getActiveCareTarget(): Promise<CareTarget | null> {
      const u = requireLogin();
      if (!u.activeCareTargetId) return null;
      const all = await loadCareTargets();
      return all.find((ct) => ct.id === u.activeCareTargetId) ?? null;
    }

    async function setActiveCareTarget(careTargetId: CareTargetId) {
      const u = requireLogin();
      if (!u.linkedCareTargetIds.includes(careTargetId)) {
        throw new Error("你沒有連結到此長輩，不能切換");
      }
      setUser({ ...u, activeCareTargetId: careTargetId });
    }

    async function createCareTarget(name: string): Promise<CareTarget> {
      const u = requireLogin();
      name = name.trim();
      if (!name) throw new Error("長輩名稱不可為空");

      const all = await loadCareTargets();

      let invite = makeInviteCode();
      for (let i = 0; i < 20; i++) {
        if (!all.some((x) => x.inviteCode === invite)) break;
        invite = makeInviteCode();
      }

      const ct: CareTarget = {
        id: nowId("ct"),
        name,
        createdAt: Date.now(),
        inviteCode: invite,
      };

      await saveCareTargets([ct, ...all]);

      const linked = u.linkedCareTargetIds.includes(ct.id) ? u.linkedCareTargetIds : [ct.id, ...u.linkedCareTargetIds];
      setUser({ ...u, linkedCareTargetIds: linked, activeCareTargetId: ct.id });

      const users = await loadUsers();
      const idx = users.findIndex((x) => x.uid === u.uid);
      if (idx >= 0) {
        const updated: StoredUser = { ...users[idx], linkedCareTargetIds: linked, activeCareTargetId: ct.id };
        const next = [...users];
        next[idx] = updated;
        await saveUsers(next);
      }

      return ct;
    }

    async function linkByInviteCode(inviteCode: string): Promise<CareTarget> {
      const u = requireLogin();
      inviteCode = inviteCode.trim().toUpperCase();
      if (!inviteCode) throw new Error("邀請碼不可為空");

      const all = await loadCareTargets();
      const ct = all.find((x) => x.inviteCode === inviteCode);
      if (!ct) throw new Error("找不到此邀請碼對應的長輩");

      const linked = u.linkedCareTargetIds.includes(ct.id) ? u.linkedCareTargetIds : [ct.id, ...u.linkedCareTargetIds];
      const active = u.activeCareTargetId ?? ct.id; // 如果本來沒選定，就直接選這個

      setUser({ ...u, linkedCareTargetIds: linked, activeCareTargetId: active });

      const users = await loadUsers();
      const idx = users.findIndex((x) => x.uid === u.uid);
      if (idx >= 0) {
        const updated: StoredUser = { ...users[idx], linkedCareTargetIds: linked, activeCareTargetId: active };
        const next = [...users];
        next[idx] = updated;
        await saveUsers(next);
      }

      return ct;
    }

    return {
      ready,
      user,

      register,
      login,
      logout,

      getMyCareTargets,
      getActiveCareTarget,
      setActiveCareTarget,
      createCareTarget,
      linkByInviteCode,
    };
  }, [ready, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
