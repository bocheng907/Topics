// app/agency/_layout.tsx
import { auth } from "@/firebase/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useSegments } from "expo-router";
import { signOut } from "firebase/auth";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = SCREEN_WIDTH * 0.55;

export default function AgencyLayout() {
  const segments = useSegments() as string[];
  const currentPage = segments[segments.length - 1];
  const insets = useSafeAreaInsets();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // 只有仲介首頁顯示右上角漢堡
  const isAgencyHome = currentPage === "agency";

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isSidebarOpen ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
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

  const handleLogout = () => {
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
          StyleSheet.absoluteFillObject,
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
            transform: [{ translateX }],
            paddingTop: insets.top + 40,
          },
        ]}
      >
        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>仲介模式</Text>
          </View>
        </View>

        <View style={styles.menuContainer}>
          <Pressable
            style={styles.menuItem}
            onPress={() => goTo("/agency")}
          >
            <Text style={styles.menuItemText}>仲介首頁</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => goTo("/agency/caregivers")}
          >
            <Text style={styles.menuItemText}>旗下看護</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setIsSidebarOpen(false);
              Alert.alert("問題回報", "下一階段會建立問題回報頁面");
            }}
          >
            <Text style={styles.menuItemText}>問題回報</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setIsSidebarOpen(false);
              Alert.alert("仲介邀請碼", "下一階段會建立仲介邀請碼功能");
            }}
          >
            <Text style={styles.menuItemText}>仲介邀請碼</Text>
          </Pressable>

          <Pressable style={styles.menuItem} onPress={handleLogout}>
            <Text style={styles.menuItemTextDanger}>登出</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    width: DRAWER_WIDTH,
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