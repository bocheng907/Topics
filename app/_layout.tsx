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
        headerShown: false,
        gestureEnabled: false
      }}
    >
      {/* 1. 先放分組路由 */}
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      
      {/* 2. 再放獨立功能頁面 */}
      <Stack.Screen name="care-target" />

      {/* 💡 修正：如果警告持續存在，嘗試「不」在根目錄定義子頁面，
          讓 Expo Router 自動根據檔案路徑解析。
          或者，確保這裡的 name 字串與路徑完全相同（無副檔名）。 */}
      <Stack.Screen name="caregiver/chat-room" />
      <Stack.Screen name="family/chat-room" />
      
      {/* 3. 最後放資料夾入口 */}
      <Stack.Screen name="family" />
      <Stack.Screen name="caregiver" />
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