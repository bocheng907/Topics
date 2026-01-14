import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Role = "caregiver" | "family";

export type AuthUser = {
  uid: string;           // 本地先用 uid_時間戳，Firebase 之後換成真 uid
  email: string;
  role: Role;
  careTargetId: "ct_001";
};

type AuthValue = {
  ready: boolean;
  user: AuthUser | null;

  register: (email: string, password: string, role: Role) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

const KEY_USERS = "careapp_users_v1";
const KEY_SESSION = "careapp_session_v1";

type StoredUser = AuthUser & { password: string };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  // 啟動時：讀 session
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY_SESSION);
        if (raw) setUser(JSON.parse(raw));
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // session 變動：寫回
  useEffect(() => {
    if (!ready) return;
    (async () => {
      if (user) await AsyncStorage.setItem(KEY_SESSION, JSON.stringify(user));
      else await AsyncStorage.removeItem(KEY_SESSION);
    })();
  }, [user, ready]);

  const value = useMemo<AuthValue>(() => {
    async function loadUsers(): Promise<StoredUser[]> {
      const raw = await AsyncStorage.getItem(KEY_USERS);
      return raw ? (JSON.parse(raw) as StoredUser[]) : [];
    }

    async function saveUsers(users: StoredUser[]) {
      await AsyncStorage.setItem(KEY_USERS, JSON.stringify(users));
    }

    async function register(email: string, password: string, role: Role) {
      email = email.trim().toLowerCase();
      if (!email || !password) throw new Error("Email / 密碼不可為空");
      if (password.length < 6) throw new Error("密碼至少 6 碼（先用最簡版規則）");

      const users = await loadUsers();
      const exists = users.some((u) => u.email === email);
      if (exists) throw new Error("此 Email 已註冊");

      const newUser: StoredUser = {
        uid: `uid_${Date.now()}`,
        email,
        password,
        role,
        careTargetId: "ct_001",
      };

      await saveUsers([newUser, ...users]);

      // 註冊完直接登入
      const { password: _, ...sessionUser } = newUser;
      setUser(sessionUser);
    }

    async function login(email: string, password: string) {
      email = email.trim().toLowerCase();
      const users = await loadUsers();
      const found = users.find((u) => u.email === email);

      if (!found) throw new Error("找不到此帳號");
      if (found.password !== password) throw new Error("密碼錯誤");

      const { password: _, ...sessionUser } = found;
      setUser(sessionUser);
    }

    async function logout() {
      setUser(null);
    }

    return { ready, user, register, login, logout };
  }, [ready, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
