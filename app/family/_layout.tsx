// app/family/_layout.tsx
import { exportCopy } from "@/src/export/exportCopy";
import { invitationCopy } from "@/src/care-target/invitationCopy";
import { auth } from "@/firebase/firebaseConfig";
import AuditMenuLink from "@/src/audit/AuditMenuLink";
import { PrivacyPolicyLink } from "@/src/privacy/PrivacyPolicyLink";
import { translations } from "@/src/i18n/translations";
import { myDataCopy } from "@/src/profile/myDataCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useSegments } from "expo-router";
import { signOut } from "@/src/auth/auditSession";
import React, { useEffect, useState } from "react";
import { Animated, Platform, ScrollView, useWindowDimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { useSafeAreaInsets } from "react-native-safe-area-context";


export default function FamilyLayout() {
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(width - 24, Math.max(280, width * 0.82));
  const segments = useSegments() as string[];
  const currentPage = segments[segments.length - 1];
  const insets = useSafeAreaInsets();
  const { language, setLanguage } = useLanguage();
  const t = translations[language];

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
  const hideBottomNav = hideBottomNavRoutes.includes(currentPage);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [slideAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isSidebarOpen ? 1 : 0,
      duration: 300,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [isSidebarOpen, slideAnim]);

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [drawerWidth, 0],
  });

  const overlayOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const handleLogout = async () => {
    // Web 測試
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "確定要登出目前帳號嗎？"
      );

      if (!confirmed) return;

      try {
        await signOut(auth);
        setIsSidebarOpen(false);
        router.replace("/");
      } catch (error) {
        console.log("登出失敗:", error);
        window.alert("登出失敗，請稍後再試");
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
            setIsSidebarOpen(false);
            router.replace("/");
          } catch (error) {
            console.log("登出失敗:", error);
            Alert.alert(t.resultErrorTitle, t.logoutFailed);
          }
        },
      },
    ]);
  };

  const changeLanguage = (nextLanguage: "zh" | "en" | "vi" | "id") => {
    setLanguage(nextLanguage);
    setIsSidebarOpen(false);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.content, hideBottomNav && { paddingBottom: insets.bottom }]}>
        <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
      </View>

      {!hideBottomNav && !segments.includes("community") && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={{ zh: "開啟選單", en: "Open menu", vi: "Mở menu", id: "Buka menu" }[language]}
          accessibilityState={{ expanded: isSidebarOpen }}
          style={[styles.hamburgerBtn, { top: insets.top + 10 }]}
          onPress={() => setIsSidebarOpen(true)}
        >
          <Ionicons name="menu" size={40} color="black" />
        </Pressable>
      )}

      {!hideBottomNav && (
        <View style={[styles.bottomNav, { paddingBottom: Math.max(16, insets.bottom + 12) }]}>
          <Pressable onPress={() => router.navigate("/family" as any)}>
            <Ionicons name="home" size={32} color="#333" />
          </Pressable>

          <Pressable onPress={() => router.push("/family/calendar" as any)}>
            <Ionicons name="calendar" size={32} color="#333" />
          </Pressable>

          <Pressable onPress={() => router.push("/family/notifications" as any)}>
            <Ionicons name="notifications" size={32} color="#333" />
          </Pressable>

          <Pressable onPress={() => router.push("/family/chat-list" as any)}>
            <Ionicons name="chatbubbles" size={32} color="#333" />
          </Pressable>
        </View>
      )}

      <Animated.View
        pointerEvents={isSidebarOpen ? "auto" : "none"}
        style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayOpacity }]}
      >
        <Pressable style={{ flex: 1 }} onPress={() => setIsSidebarOpen(false)} />
      </Animated.View>

      <Animated.View
        style={[
          styles.drawer,
          {
            display: isSidebarOpen ? "flex" : "none",
            width: drawerWidth,
            transform: [{ translateX }],
            paddingTop: insets.top + 16,
          },
        ]}
      >
        <View style={styles.badgeContainer}>
          <View style={[styles.badge, { backgroundColor: "#F5A623" }]}>
            <Text style={styles.badgeText}>{t.familyMode}</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.menuContainer, { paddingBottom: insets.bottom + 24 }]}>
          <AuditMenuLink onNavigate={() => setIsSidebarOpen(false)} />
          <PrivacyPolicyLink variant="menu" />
          <Pressable style={styles.menuItem} onPress={() => {
            setIsSidebarOpen(false);
            router.push("/family/community" as any);
          }}>
            <Text style={styles.menuItemText}>照顧者交流</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => {
            setIsSidebarOpen(false);
            router.push("/my-data" as any);
          }}>
            <Text style={styles.menuItemText}>{myDataCopy[language].title}</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => { setIsSidebarOpen(false); router.push("/care-target/invitations" as any); }}>
            <Text style={styles.menuItemText}>{invitationCopy[language].title}</Text>
          </Pressable>
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setIsSidebarOpen(false);
              router.push("/family/report-care-issue" as any);
            }}
          >
            <Text style={styles.menuItemText}>
              {language === "zh"
                ? "回報照護問題"
                : language === "en"
                  ? "Report Care Issue"
                  : language === "vi"
                    ? "Báo cáo vấn đề chăm sóc"
                    : "Laporkan Masalah Perawatan"}
            </Text>
          </Pressable>
          <View style={styles.menuItem}>
            <Text style={styles.menuItemText}>{t.language}</Text>
            <View style={styles.languageOptions}>
              <Pressable onPress={() => changeLanguage("zh")}>
                <Text style={[styles.languageOption, language === "zh" && styles.languageOptionActive]}>
                  中文
                </Text>
              </Pressable>
              <Pressable onPress={() => changeLanguage("en")}>
                <Text style={[styles.languageOption, language === "en" && styles.languageOptionActive]}>
                  English
                </Text>
              </Pressable>
              <Pressable onPress={() => changeLanguage("vi")}>
                <Text style={[styles.languageOption, language === "vi" && styles.languageOptionActive]}>
                  Tiếng Việt
                </Text>
              </Pressable>
              <Pressable onPress={() => changeLanguage("id")}>
                <Text style={[styles.languageOption, language === "id" && styles.languageOptionActive]}>
                  Bahasa Indonesia
                </Text>
              </Pressable>
            </View>
          </View>
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setIsSidebarOpen(false);
              router.push("/family/handbook" as any);
            }}
          >
            <Text style={styles.menuItemText}>{t.handbook}</Text>
          </Pressable>
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setIsSidebarOpen(false);
              router.push("/family/emergency-contacts" as any);
            }}
          >
            <Text style={styles.menuItemText}>{t.emergencyPhoneSettings}</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setIsSidebarOpen(false);
              router.push("/account-settings" as any);
            }}
          >
            <Text style={styles.menuItemText}>帳號設定</Text>
          </Pressable>

          <Pressable style={styles.menuItem} onPress={() => Alert.alert(t.warning, t.unlinkConfirm)}>
            <Text style={styles.menuItemTextDanger}>{t.unlink}</Text>
          </Pressable>

          <Pressable style={styles.menuItem} onPress={() => {
            setIsSidebarOpen(false);
            router.push("/personal-data-export" as any);
          }}>
            <Text style={styles.menuItemText}>{exportCopy[language].title}</Text>
          </Pressable>

          <Pressable style={styles.menuItem} onPress={handleLogout}>
            <Text style={styles.menuItemTextDanger}>{t.logout}</Text>
          </Pressable>


          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setIsSidebarOpen(false);
              router.push("/account-deletion" as any);
            }}
          >
            <Text style={styles.menuItemTextDanger}>刪除帳號</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF", overflow: "hidden" },
  content: { flex: 1 },
  hamburgerBtn: {
    position: "absolute",
    right: 20,
    zIndex: 40,
    padding: 8,
  },
  bottomNav: {
    backgroundColor: "#EAEAEA",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
    zIndex: 10,
  },
  overlay: {
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 100,
  },
  drawer: { position: "absolute", top: 0, right: 0, bottom: 0, backgroundColor: "#FFF", zIndex: 101, borderLeftWidth: 2, borderLeftColor: "#000", shadowColor: "#000", shadowOffset: { width: -5, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 20 },
  badgeContainer: { alignItems: "center", marginBottom: 16 },
  badge: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 17,
    letterSpacing: 2,
  },
  menuContainer: {
    borderTopWidth: 2,
    borderTopColor: "#000",
  },
  menuItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#000",
  },
  menuItemText: {
    color: "#000",
    fontSize: 18,
    fontWeight: "bold",
    flexShrink: 1,
    flexWrap: "wrap",
    lineHeight: 25,
  },
  languageOptions: {
    marginTop: 10,
    gap: 8,
  },
  languageOption: {
    color: "#555",
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
    flexWrap: "wrap",
    lineHeight: 22,
  },
  languageOptionActive: {
    color: "#007AFF",
  },
  menuItemTextDanger: {
    color: "#E33B3B",
    fontSize: 18,
    fontWeight: "bold",
    flexShrink: 1,
    flexWrap: "wrap",
    lineHeight: 25,
  },
});
