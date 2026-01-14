import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/src/auth/useAuth";

export default function Index() {
  const { ready, user } = useAuth();

  useEffect(() => {
    if (!ready) return;

    if (!user) {
      router.replace("/(auth)/login");
      return;
    }

    router.replace(user.role === "caregiver" ? "/caregiver" : "/family");
  }, [ready, user]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator />
    </View>
  );
}
