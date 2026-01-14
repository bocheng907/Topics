import { Stack } from "expo-router";
import { StoreProvider } from "@/src/store/StoreProvider";
import { AuthProvider } from "@/src/auth/AuthProvider";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StoreProvider>
        <Stack screenOptions={{ headerTitleAlign: "center" }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="caregiver" options={{ headerShown: false }} />
          <Stack.Screen name="family" options={{ headerShown: false }} />
        </Stack>
      </StoreProvider>
    </AuthProvider>
  );
}
