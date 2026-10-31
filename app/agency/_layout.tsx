// app/agency/_layout.tsx
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { auth } from "@/firebase/firebaseConfig";
import { Redirect, Stack, router } from "expo-router";
import { signOut } from "@/src/auth/auditSession";
import { useAuth } from "@/src/auth/useAuth";
import { exportCopy } from "@/src/export/exportCopy";
import { translations } from "@/src/i18n/translations";
import { PrivacyPolicyLink } from "@/src/privacy/PrivacyPolicyLink";
import { myDataCopy } from "@/src/profile/myDataCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import AuditMenuLink from "@/src/audit/AuditMenuLink";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { DrawerProvider, useDrawer } from "@/src/ui/DrawerContext";
import { SideDrawer, SideDrawerProfile, type SideDrawerSection } from "@/src/ui/components";
import { useCommunityProfile } from "@/src/community/useCommunityProfile";
import { colors } from "@/src/ui/theme";

export default function AgencyLayout() {
  return (
    <DrawerProvider>
      <AgencyShell />
    </DrawerProvider>
  );
}

function AgencyShell() {
  const { ready, user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const drawer = useDrawer();
  const drawerProfile = useCommunityProfile();

  const goTo = (path: string) => {
    drawer.close();
    router.push(path as any);
  };

  const handleLogout = async () => {
    // Web 測試
    if (Platform.OS === "web") {
      const confirmed = window.confirm(t.logoutMessage);

      if (!confirmed) return;

      try {
        await signOut(auth);
        drawer.close();
        router.replace("/");
      } catch (error) {
        console.log("登出失敗:", error);
        window.alert(t.logoutFailed);
      }

      return;
    }

    //手機版
    Alert.alert(t.logout, t.logoutMessage, [
      {
        text: t.cancel,
        style: "cancel",
      },
      {
        text: t.logoutConfirm,
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            drawer.close();
            router.replace("/");
          } catch (error) {
            console.log("agency logout failed:", error);
            Alert.alert(t.resultErrorTitle, t.logoutFailed);
          }
        },
      },
    ]);
  };

  if (!ready) return null;
  if (!user || user.role !== "agency") return <Redirect href="/" />;

  const sections: SideDrawerSection[] = [
    {
      key: "community",
      title: t.drawerSectionCommunity,
      items: [{ key: "community", icon: "people-outline", label: t.navCommunity, onPress: () => goTo("/agency/community") }],
    },
    {
      key: "account",
      title: t.drawerSectionAccount,
      items: [
        { key: "account-settings", icon: "settings-outline", label: t.navAccountSettings, onPress: () => goTo("/account-settings") },
        { key: "my-data", icon: "person-circle-outline", label: myDataCopy[language].title, onPress: () => goTo("/my-data") },
        { key: "personal-data-export", icon: "download-outline", label: exportCopy[language].title, onPress: () => goTo("/personal-data-export") },
      ],
      content: (
        <>
          <AuditMenuLink variant="drawer" onNavigate={drawer.close} />
          <PrivacyPolicyLink variant="drawer" />
        </>
      ),
    },
    {
      key: "danger",
      title: t.drawerSectionDanger,
      items: [
        { key: "logout", icon: "log-out-outline", label: t.logout, tone: "danger", onPress: handleLogout },
        { key: "account-deletion", icon: "trash-outline", label: t.navDeleteAccount, tone: "danger", onPress: () => goTo("/account-deletion") },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Stack
          screenOptions={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
      </View>

      <SideDrawer
        open={drawer.isOpen}
        onClose={drawer.close}
        header={<SideDrawerProfile roleLabel={t.agencyMode} icon="business" name={drawerProfile.name || user.email || undefined} />}
        sections={sections}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },

  content: {
    flex: 1,
  },
});
