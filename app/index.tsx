// app/index.tsx
import { Redirect } from "expo-router";
import { useAuth } from "@/src/auth/useAuth";

export default function Index() {
  const { user, ready } = useAuth();

  // ✅ 還在讀本地登入狀態時：先不要跳，避免 RootLayout 還沒掛好就導航
  if (!ready) return null;

  // ✅ 未登入：去登入頁
  if (!user) return <Redirect href="/(auth)/login" />;

  // ✅ 已登入：依角色導向
  if (user.role === "caregiver") return <Redirect href="/caregiver" />;
  if (user.role === "family") return <Redirect href="/family" />;

  // 防呆：角色不明就回登入
  return <Redirect href="/(auth)/login" />;
}
