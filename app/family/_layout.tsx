// app/family/_layout.tsx
import { exportCopy } from "@/src/export/exportCopy";
import { invitationCopy } from "@/src/care-target/invitationCopy";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { auth } from "@/firebase/firebaseConfig";
import AuditMenuLink from "@/src/audit/AuditMenuLink";
import { useAuth } from "@/src/auth/useAuth";
import { PrivacyPolicyLink } from "@/src/privacy/PrivacyPolicyLink";
import { translations, type Language } from "@/src/i18n/translations";
import { myDataCopy } from "@/src/profile/myDataCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { Stack, router, useSegments } from "expo-router";
import { signOut } from "@/src/auth/auditSession";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { DrawerProvider, useDrawer } from "@/src/ui/DrawerContext";
import {
  BottomNav,
  DrawerLanguageSwitcher,
  SideDrawer,
  SideDrawerProfile,
  type BottomNavItem,
  type SideDrawerSection,
} from "@/src/ui/components";
import { useCommunityProfile } from "@/src/community/useCommunityProfile";
import { colors } from "@/src/ui/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const hideBottomNavRoutes = [
  "camera",
  "scan-result",
  "result",
  "chat-room",
  "detail",
  "edit",
  "dashboard",
  "list",
  "medication-detail",
  "condition",
  "voice",
  "handbook",
  "notification-detail",
  "account-settings",
  "emergency-contacts",
  "report-care-issue",
  "new-post",
];

export default function FamilyLayout() {
  return (
    <DrawerProvider>
      <FamilyShell />
    </DrawerProvider>
  );
}

function FamilyShell() {
  const segments = useSegments() as string[];
  const currentPage = segments[segments.length - 1];
  const insets = useSafeAreaInsets();
  const { language, setLanguage } = useLanguage();
  const t = translations[language];
  const drawer = useDrawer();
  const drawerProfile = useCommunityProfile();
  const { user } = useAuth();
  const { activePatient } = useActiveCareTarget();

  const hideBottomNav = hideBottomNavRoutes.includes(currentPage);

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
      { text: t.cancel, style: "cancel" },
      {
        text: t.logoutConfirm,
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            drawer.close();
            router.replace("/");
          } catch (error) {
            console.log("登出失敗:", error);
            Alert.alert(t.resultErrorTitle, t.logoutFailed);
          }
        },
      },
    ]);
  };

  const changeLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    drawer.close();
  };

  const go = (path: string) => () => {
    drawer.close();
    router.push(path as any);
  };

  const sections: SideDrawerSection[] = [
    {
      key: "care",
      title: t.drawerSectionCare,
      items: [
        { key: "community", icon: "people-outline", label: t.navCommunity, onPress: go("/family/community") },
        { key: "report-care-issue", icon: "alert-circle-outline", label: t.navReportCareIssue, onPress: go("/family/report-care-issue") },
        { key: "handbook", icon: "book-outline", label: t.handbook, onPress: go("/family/handbook") },
        { key: "emergency-contacts", icon: "call-outline", label: t.emergencyPhoneSettings, onPress: go("/family/emergency-contacts") },
        { key: "invitations", icon: "person-add-outline", label: invitationCopy[language].title, onPress: go("/care-target/invitations") },
      ],
    },
    {
      key: "account",
      title: t.drawerSectionAccount,
      items: [
        { key: "account-settings", icon: "settings-outline", label: t.navAccountSettings, onPress: go("/account-settings") },
        { key: "my-data", icon: "person-circle-outline", label: myDataCopy[language].title, onPress: go("/my-data") },
        { key: "personal-data-export", icon: "download-outline", label: exportCopy[language].title, onPress: go("/personal-data-export") },
      ],
      content: (
        <>
          <AuditMenuLink variant="drawer" onNavigate={drawer.close} />
          <PrivacyPolicyLink variant="drawer" />
        </>
      ),
    },
    {
      key: "language",
      title: t.language,
      items: [],
      content: <DrawerLanguageSwitcher value={language} onChange={changeLanguage} />,
    },
    {
      key: "danger",
      title: t.drawerSectionDanger,
      items: [
        // Same behaviour as before: a warning alert only, the drawer stays open.
        { key: "unlink", icon: "link-outline", label: t.unlink, tone: "danger", onPress: () => Alert.alert(t.warning, t.unlinkConfirm) },
        { key: "logout", icon: "log-out-outline", label: t.logout, tone: "danger", onPress: handleLogout },
        { key: "account-deletion", icon: "trash-outline", label: t.navDeleteAccount, tone: "danger", onPress: go("/account-deletion") },
      ],
    },
  ];

  const navItems: BottomNavItem[] = [
    { key: "family", icon: "home-outline", activeIcon: "home", label: t.navHome },
    { key: "calendar", icon: "calendar-outline", activeIcon: "calendar", label: t.navCalendar },
    { key: "notifications", icon: "notifications-outline", activeIcon: "notifications", label: t.navNotifications },
    { key: "chat-list", icon: "chatbubbles-outline", activeIcon: "chatbubbles", label: t.navChat },
  ];

  const onSelectNav = (key: string) => {
    if (key === "family") router.navigate("/family" as any);
    else if (key === "calendar") router.push("/family/calendar" as any);
    else if (key === "notifications") router.push("/family/notifications" as any);
    else if (key === "chat-list") router.push("/family/chat-list" as any);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.content, hideBottomNav && { paddingBottom: insets.bottom }]}>
        <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
      </View>

      {!hideBottomNav && <BottomNav items={navItems} activeKey={currentPage} onSelect={onSelectNav} />}

      <SideDrawer
        open={drawer.isOpen}
        onClose={drawer.close}
        header={
          <SideDrawerProfile
            roleLabel={t.familyMode}
            name={drawerProfile.name || user?.email || undefined}
            detail={activePatient?.name ? `${t.drawerCareTarget}${language === "zh" ? "：" : ": "}${activePatient.name}` : undefined}
          />
        }
        sections={sections}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, overflow: "hidden" },
  content: { flex: 1 },
});
