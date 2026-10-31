import { auth, db } from "@/firebase/firebaseConfig";
import { exportCopy } from "@/src/export/exportCopy";
import AuditMenuLink from "@/src/audit/AuditMenuLink";
import { useAuth } from "@/src/auth/useAuth";
import { PrivacyPolicyLink } from "@/src/privacy/PrivacyPolicyLink";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { useSyncCaregiverServices } from "@/src/agency/useSyncCaregiverServices";
import { translations, type Language } from "@/src/i18n/translations";
import { myDataCopy } from "@/src/profile/myDataCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useSegments } from "expo-router";
import { signOut } from "@/src/auth/auditSession";
import { doc, getDoc } from "firebase/firestore";
import React from "react";
import { Alert, Platform, Linking, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DrawerProvider, useDrawer } from "@/src/ui/DrawerContext";
import {
  BottomNav,
  DrawerLanguageSwitcher,
  SideDrawer,
  SideDrawerProfile,
  type BottomNavItem,
  type SideDrawerSection,
} from "@/src/ui/components";
import { colors, shadows } from "@/src/ui/theme";

const hideBottomNavRoutes = [
  "chat-room",
  "detail",
  "edit",
  "camera",
  "list",
  "medication-detail",
  "video-record",
  "health-report",
  "communication-cards",
  "notebook",
  "handbook",
  "notification-detail",
  "account-settings",
  "agency-binding",
  "result",
];

/** Emergency button size and how far it rises above the bottom bar. */
const FAB_SIZE = 68;
const FAB_RISE = 22;

export default function CaregiverLayout() {
  return (
    <DrawerProvider>
      <CaregiverShell />
    </DrawerProvider>
  );
}

function CaregiverShell() {
  const segments = useSegments() as string[];
  const currentPage = segments[segments.length - 1];
  const insets = useSafeAreaInsets();
  const { language, setLanguage } = useLanguage();
  const t = translations[language];
  const drawer = useDrawer();
  const { user } = useAuth();

  useSyncCaregiverServices();

  const hideBottomNav = hideBottomNavRoutes.includes(currentPage);

  const activeCareTarget = useActiveCareTarget();
  const activePatientId =
    (activeCareTarget as any)?.activePatientId ??
    (activeCareTarget as any)?.activeCareTargetId ??
    "";
  const activePatientName: string | undefined = (activeCareTarget as any)?.activePatient?.name || undefined;

  async function makePhoneCall(phone: string) {
    try {
      const url = `tel:${phone}`;
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(t.callFailedTitle, t.callUnsupportedMessage);
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      console.log("phone call failed:", e);
      Alert.alert(t.callFailedTitle, t.callNumberFailedMessage);
    }
  }

  async function onEmergencyCall() {
    if (!activePatientId) {
      Alert.alert(t.emergencyNoTargetTitle, t.emergencyNoTargetMessage);
      return;
    }

    try {
      const patientSnap = await getDoc(doc(db, "patients", activePatientId));
      if (!patientSnap.exists()) {
        Alert.alert(t.resultErrorTitle, t.emergencyTargetNotFound);
        return;
      }

      const data = patientSnap.data() as any;
      const phone1 = String(data.emergencyPhone1 ?? "").trim();
      const phone2 = String(data.emergencyPhone2 ?? "").trim();
      const phones = [phone1, phone2].filter(Boolean);

      if (phones.length === 0) {
        Alert.alert(t.emergencyNotSetTitle, t.emergencyNotSetMessage);
        return;
      }
      if (phones.length === 1) {
        await makePhoneCall(phones[0]);
        return;
      }
      Alert.alert(t.emergencyChooseTitle, t.emergencyChooseMessage, [
        { text: `${t.emergencyPhone1Option}${phones[0]}`, onPress: () => void makePhoneCall(phones[0]) },
        { text: `${t.emergencyPhone2Option}${phones[1]}`, onPress: () => void makePhoneCall(phones[1]) },
        { text: t.cancel, style: "cancel" },
      ]);
    } catch (e) {
      console.log("emergency call failed:", e);
      Alert.alert(t.callFailedTitle, t.emergencyCallFailedMessage);
    }
  }

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
        { key: "notebook", icon: "create-outline", label: t.navNotebook, onPress: go("/caregiver/notebook") },
        { key: "handbook", icon: "book-outline", label: t.handbook, onPress: go("/caregiver/handbook") },
        { key: "select-care-target", icon: "swap-horizontal-outline", label: t.selectCareTarget, onPress: go("/care-target/select") },
        { key: "agency-binding", icon: "business-outline", label: t.navAgencyBinding, onPress: go("/caregiver/agency-binding") },
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
        { key: "leave", icon: "link-outline", label: t.unlink, tone: "danger", onPress: go("/care-target/leave") },
        { key: "logout", icon: "log-out-outline", label: t.logout, tone: "danger", onPress: handleLogout },
        { key: "account-deletion", icon: "trash-outline", label: t.navDeleteAccount, tone: "danger", onPress: go("/account-deletion") },
      ],
    },
  ];

  const navItems: BottomNavItem[] = [
    { key: "caregiver", icon: "home-outline", activeIcon: "home", label: t.navHome },
    { key: "calendar", icon: "calendar-outline", activeIcon: "calendar", label: t.navCalendar },
    { key: "notifications", icon: "notifications-outline", activeIcon: "notifications", label: t.navNotifications },
    { key: "chat-list", icon: "chatbubbles-outline", activeIcon: "chatbubbles", label: t.navChat },
  ];

  const onSelectNav = (key: string) => {
    if (key === "caregiver") router.navigate("/caregiver" as any);
    else if (key === "calendar") router.navigate("/caregiver/calendar" as any);
    else if (key === "notifications") router.navigate("/caregiver/notifications" as any);
    else if (key === "chat-list") router.navigate("/caregiver/chat-list" as any);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.content, hideBottomNav && { paddingBottom: insets.bottom }]}>
        <Stack
          screenOptions={{
            headerShown: false,
            gestureEnabled: false,
            animation: "none",
          }}
        />
      </View>

      {!hideBottomNav && !!activePatientId && (
        <View style={styles.footerWrapper} pointerEvents="box-none">
          <BottomNav items={navItems} activeKey={currentPage} onSelect={onSelectNav} centerGap={FAB_SIZE + 20} />
          <View style={styles.fabContainer} pointerEvents="box-none">
            <Pressable
              style={({ pressed }) => [styles.fabButton, pressed && styles.fabPressed]}
              onPress={onEmergencyCall}
              accessibilityRole="button"
              accessibilityLabel={t.emergencyCall}
            >
              <Ionicons name="call" size={30} color={colors.onAccent} />
            </Pressable>
          </View>
        </View>
      )}

      <SideDrawer
        open={drawer.isOpen}
        onClose={drawer.close}
        header={
          <SideDrawerProfile
            roleLabel={t.caregiverMode}
            name={user?.email || undefined}
            detail={activePatientName ? `${t.drawerCareTarget}${language === "zh" ? "：" : ": "}${activePatientName}` : undefined}
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
  // Transparent top padding keeps the raised button inside the wrapper's bounds (so it stays tappable on Android).
  footerWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: FAB_RISE,
  },
  fabContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  fabButton: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: colors.surface,
    ...shadows.fab,
  },
  fabPressed: { backgroundColor: colors.accentPressed },
});
