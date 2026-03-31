// app/(tabs)/index.tsx
import { useAuthContext } from "@/src/auth/AuthProvider";
import { Redirect } from "expo-router";

export default function Index() {
  const { ready, user } = useAuthContext();

  if (!ready) return null;

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  // 💡 修正這裡：依照身分派發，而不是一律去 select
  if (user.role === "family") {
    return <Redirect href="/family" />;
  } else {
    return <Redirect href="/caregiver" />;
  }
}