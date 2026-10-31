// app/_layout.tsx
import { AuthProvider } from "@/src/auth/AuthProvider";
import { useAuth } from "@/src/auth/useAuth";
import { ActiveCareTargetProvider } from "@/src/care-target/useActiveCareTarget";
import { registerForPushToken } from "@/src/notifications/registerForPushToken";
import { LanguageProvider } from "@/src/store/LanguageContext";
import { StoreProvider } from "@/src/store/StoreProvider";
import { ClientOnly } from "@/src/ui/ClientOnly";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { useEffect } from "react";

function RootLayoutNav() {
  const { user, ready } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();

  const navigationState = useRootNavigationState();
  const isNavigationReady = Boolean(navigationState?.key) && ready;

  useEffect(() => {
    if (!isNavigationReady) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inAccountDeletion = segments[0] === "account-deletion";
    // Dev-only design-system pages (app/dev/*) are reachable while logged out.
    // __DEV__ is false in production builds, so this never relaxes auth there.
    const inDevTools = __DEV__ && segments[0] === "dev";

    if (user?.accountStatus === "pending_deletion" && !inAccountDeletion) {
      router.replace("/account-deletion" as any);
    } else if (user && inAuthGroup) {
      router.replace("/");
    } else if (!user && !inAuthGroup && !inDevTools) {
      router.replace("/(auth)/login");
    }
  }, [user, segments, isNavigationReady, router]);

  useEffect(() => {
    if (!user?.uid || user.accountStatus === "pending_deletion") return;

    (async () => {
      try {
        console.log("[push] current uid =", user.uid);
        await registerForPushToken(user.uid);
      } catch (error) {
        console.log("[push] register token failed:", error);
      }
    })();
  }, [user?.uid, user?.accountStatus]);

  return (
    <Stack
      screenOptions={{
        headerTitleAlign: "center",
        headerShown: false,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="caregiver" options={{ headerShown: false }} />
      <Stack.Screen name="family" options={{ headerShown: false }} />
      <Stack.Screen name="agency" options={{ headerShown: false }} />
      <Stack.Screen name="care-target" options={{ headerShown: false }} />
      <Stack.Screen name="account-deletion" options={{ headerShown: false }} />
      <Stack.Screen name="personal-data-export" options={{ headerShown: false }} />
      <Stack.Screen name="audit-logs" options={{ headerShown: false }} />
      <Stack.Screen name="my-data" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <StoreProvider>
          <ActiveCareTargetProvider>
            {/* Session, locale and viewport are client-specific on web. */}
            <ClientOnly><RootLayoutNav /></ClientOnly>
          </ActiveCareTargetProvider>
        </StoreProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
