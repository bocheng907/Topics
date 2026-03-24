// app/index.tsx
import { useAuth } from "@/src/auth/useAuth";
import { Redirect } from "expo-router";

export default function Index() {
  const { user, ready } = useAuth();

  // 還在讀 AsyncStorage session 的時候：先不要跳，避免閃一下又跳回登入
  if (!ready) return null;

  // 沒登入 → 去登入頁
  if (!user) return <Redirect href="/(auth)/login" />;

  // ✅ 已登入 → 依照身分導向專屬的控制台
  if (user?.role === "family") {
    return <Redirect href="/family" />;
  } else {
    // 預設或身分為 caregiver，導向看護控制台
    return <Redirect href="/caregiver" />;
  }
}