// app/agency/_layout.tsx
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { auth } from "@/firebase/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, Stack, router, useSegments } from "expo-router";
import { signOut } from "@/src/auth/auditSession";
import { useAuth } from "@/src/auth/useAuth";
import { PrivacyPolicyLink } from "@/src/privacy/PrivacyPolicyLink";
import AuditMenuLink from "@/src/audit/AuditMenuLink";
import React, { useEffect, useState } from "react";
import {
  Animated,
  ScrollView,
  useWindowDimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";



export default function AgencyLayout() {
  const {width} = useWindowDimensions();
  const DRAWER_WIDTH = Math.min(width - 24, Math.max(280, width * 0.82));
  const {ready, user} = useAuth();
  const segments = useSegments() as string[];
  const currentPage = segments[segments.length - 1];
  const insets = useSafeAreaInsets();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [slideAnim] = useState(() => new Animated.Value(0));

  // 只有仲介首頁顯示右上角漢堡
  const isAgencyHome = currentPage === "agency";

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isSidebarOpen ? 1 : 0,
      duration: 300,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [isSidebarOpen, slideAnim]);

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [DRAWER_WIDTH, 0],
  });

  const overlayOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const goTo = (path: string) => {
    setIsSidebarOpen(false);
    router.push(path as any);
  };

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
    Alert.alert("登出", "確定要登出嗎？", [
      {
        text: "取消",
        style: "cancel",
      },
      {
        text: "登出",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            setIsSidebarOpen(false);
            router.replace("/");
          } catch (error) {
            console.log("agency logout failed:", error);
            Alert.alert("錯誤", "登出失敗，請稍後再試");
          }
        },
      },
    ]);
  };

  if (!ready) return null;
  if (!user || user.role !== "agency") return <Redirect href="/" />;

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

      {/* 仲介首頁右上角漢堡 */}
      {isAgencyHome && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="開啟選單"
          accessibilityState={{ expanded: isSidebarOpen }}
          style={[styles.hamburgerBtn, { top: insets.top + 10 }]}
          onPress={() => setIsSidebarOpen(true)}
        >
          <Ionicons name="menu" size={40} color="#111827" />
        </Pressable>
      )}

      {/* 背景遮罩 */}
      <Animated.View
        pointerEvents={isSidebarOpen ? "auto" : "none"}
        style={[
          StyleSheet.absoluteFill,
          styles.overlay,
          { opacity: overlayOpacity },
        ]}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={() => setIsSidebarOpen(false)}
        />
      </Animated.View>

      {/* 右側選單 */}
      <Animated.View
        style={[
          styles.drawer,
          {
            display: isSidebarOpen ? "flex" : "none",
            width: DRAWER_WIDTH,
            transform: [{ translateX }],
            paddingTop: insets.top + 40,
          },
        ]}
      >
        <ScrollView contentContainerStyle={{paddingBottom: insets.bottom + 24}} keyboardShouldPersistTaps="handled">
        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>仲介模式</Text>
          </View>
        </View>

        <View style={styles.menuContainer}>
            <Pressable style={styles.menuItem} onPress={() => goTo("/agency/community")}>
              <Text style={styles.menuItemText}>照顧者交流</Text>
            </Pressable>
          <Pressable style={styles.menuItem} onPress={() => goTo("/my-data")}>
            <Text style={styles.menuItemText}>我的資料</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => goTo("/personal-data-export")}>
            <Text style={styles.menuItemText}>匯出個人資料</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => goTo("/account-deletion")}>
            <Text style={styles.menuItemText}>帳號刪除</Text>
          </Pressable>
          <PrivacyPolicyLink variant="menu" />
          <AuditMenuLink onNavigate={() => setIsSidebarOpen(false)} />

          <Pressable
            style={styles.menuItem}
            onPress={() => goTo("/account-settings")}
          >
            <Text style={styles.menuItemText}>帳號設定</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={handleLogout}
          >
            <Text style={styles.menuItemTextDanger}>登出</Text>
          </Pressable>
        </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },

  content: {
    flex: 1,
  },

  hamburgerBtn: {
    position: "absolute",
    right: 20,
    zIndex: 40,
    padding: 8,
  },

  overlay: {
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 100,
  },

  drawer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "82%",
    backgroundColor: "#FFFFFF",
    zIndex: 101,
    borderLeftWidth: 2,
    borderLeftColor: "#000",
    shadowColor: "#000",
    shadowOffset: {
      width: -5,
      height: 0,
    },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 20,
  },

  badgeContainer: {
    alignItems: "center",
    marginBottom: 30,
  },

  badge: {
    backgroundColor: "#4F59D5",
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
  },

  badgeText: {
    color: "#FFFFFF",
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
    fontSize: 19,
    fontWeight: "bold",
  },

  menuItemTextDanger: {
    color: "#E33B3B",
    fontSize: 19,
    fontWeight: "bold",
  },
});
