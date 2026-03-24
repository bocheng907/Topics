// app/_layout.tsx
import { AuthProvider } from "@/src/auth/AuthProvider";
import { useAuth } from "@/src/auth/useAuth";
import { StoreProvider } from "@/src/store/StoreProvider";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";

function RootLayoutNav() {
  const { user } = useAuth(); 
  const segments = useSegments();
  const router = useRouter();
  
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  useEffect(() => {
    setIsNavigationReady(true);
  }, []);

  useEffect(() => {
    if (!isNavigationReady) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (user && inAuthGroup) {
      // 💡 修正這裡：已登入 + 在登入頁 -> 送到根目錄轉運站，讓它依據身分分流
      router.replace("/");
    } else if (!user && !inAuthGroup) {
      // 沒登入 + 在內部頁 -> 踢回登入頁
      router.replace("/(auth)/login");
    }
  }, [user, segments, isNavigationReady]);

  return (
    <Stack 
      screenOptions={{ 
        headerTitleAlign: "center",
        headerShown: false,
        gestureEnabled: false
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="caregiver" options={{ headerShown: false }} />
      <Stack.Screen name="family" options={{ headerShown: false }} />
      <Stack.Screen name="care-target" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StoreProvider>
        <RootLayoutNav />
      </StoreProvider>
    </AuthProvider>
  );
}