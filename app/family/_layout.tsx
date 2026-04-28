// app/family/_layout.tsx
import { auth } from "@/firebase/firebaseConfig"; // 🌟 引入 auth
import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useSegments } from "expo-router";
import { signOut } from "firebase/auth"; // 🌟 引入登出功能
import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 取得螢幕寬度，設定側邊欄寬度為 55%
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = SCREEN_WIDTH * 0.55; 

export default function FamilyLayout() {
  const segments = useSegments() as string[];
  const currentPage = segments[segments.length - 1];
  const insets = useSafeAreaInsets(); 

  // 💡 融合版陣列寫法：隱藏清單
  const hideBottomNavRoutes = [
    "chat-room",
    "detail",
    "edit",
    "dashboard", 
    "list",      
    "condition", 
    "voice"      
  ];
  const hideBottomNav = hideBottomNavRoutes.includes(currentPage);

  // ================= 側邊選單動畫邏輯 =================
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isSidebarOpen ? 1 : 0,
      duration: 300, 
      useNativeDriver: true, 
    }).start();
  }, [isSidebarOpen]);

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [DRAWER_WIDTH, 0], 
  });

  const overlayOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  // ===================================================

  // 🌟 真實的登出邏輯
  const handleLogout = () => {
    Alert.alert("登出系統", "確定要登出目前帳號嗎？", [
      { text: "取消", style: "cancel" },
      { 
        text: "確定登出", 
        style: "destructive", 
        onPress: async () => {
          try {
            await signOut(auth);
            setIsSidebarOpen(false);
            router.replace("/"); // 退回登入頁
          } catch (error) {
            console.log("登出失敗:", error);
            Alert.alert("錯誤", "登出失敗，請稍後再試");
          }
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      {/* 1. 上方的畫面區域 */}
      <View style={styles.content}>
        <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
      </View>

      {/* ================= 右上角漢堡按鈕 ================= */}
      {!hideBottomNav && (
        <Pressable 
          style={[styles.hamburgerBtn, { top: insets.top + 10 }]} 
          onPress={() => setIsSidebarOpen(true)}
        >
          <Ionicons name="menu" size={40} color="black" />
        </Pressable>
      )}

      {/* 2. 下方的全域共用導覽列 */}
      {!hideBottomNav && (
        <View style={styles.bottomNav}>
          <Pressable onPress={() => router.navigate("/family")}>
            <Text style={styles.navIcon}>🏠</Text>
          </Pressable>

          <Pressable onPress={() => Alert.alert("提示", "行事曆功能建置中")}>
            <Text style={styles.navIcon}>📅</Text>
          </Pressable>

          <Pressable onPress={() => Alert.alert("提示", "通知功能建置中")}>
            <Text style={styles.navIcon}>🔔</Text>
          </Pressable>

          <Pressable onPress={() => router.push("/family/chat-list")}>
            <Text style={styles.navIcon}>💬</Text>
          </Pressable>
        </View>
      )}

      {/* ================= 側邊選單 (Sidebar) ================= */}
      {/* 半透明遮罩層 */}
      <Animated.View 
        pointerEvents={isSidebarOpen ? "auto" : "none"} 
        style={[StyleSheet.absoluteFillObject, styles.overlay, { opacity: overlayOpacity }]}
      >
        <Pressable style={{ flex: 1 }} onPress={() => setIsSidebarOpen(false)} />
      </Animated.View>

      {/* 右側滑出的白色面板 */}
      <Animated.View 
        style={[
          styles.drawer, 
          { 
            transform: [{ translateX }], 
            paddingTop: insets.top + 40 
          }
        ]}
      >
        {/* 頂部標籤 (家屬端專屬橘色) */}
        <View style={styles.badgeContainer}>
          <View style={[styles.badge, { backgroundColor: "#F5A623" }]}>
            <Text style={styles.badgeText}>家屬模式</Text>
          </View>
        </View>

        {/* 選單項目 */}
        <View style={styles.menuContainer}>
          <Pressable style={styles.menuItem} onPress={() => Alert.alert("提示", "語言切換開發中")}>
            <Text style={styles.menuItemText}>語言</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => Alert.alert("提示", "看護手冊開發中")}>
            <Text style={styles.menuItemText}>看護手冊</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => Alert.alert("提示", "緊急電話設置開發中")}>
            <Text style={styles.menuItemText}>緊急電話設置</Text>
          </Pressable>
          
          <Pressable style={styles.menuItem} onPress={() => Alert.alert("警告", "確定要解除連結嗎？")}>
            <Text style={styles.menuItemTextDanger}>解除連結</Text>
          </Pressable>
          
          <Pressable style={styles.menuItem} onPress={handleLogout}>
            <Text style={styles.menuItemTextDanger}>登出系統</Text>
          </Pressable>
        </View>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  content: { flex: 1 },
  
  // --- 漢堡按鈕樣式 ---
  hamburgerBtn: {
    position: "absolute",
    right: 20,
    zIndex: 40,
    padding: 8,
  },

  // --- 底部導覽列樣式 ---
  bottomNav: {
    backgroundColor: "#EAEAEA",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 16,
    paddingBottom: 32, // 適應 iPhone 底部海苔條
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
    zIndex: 10,
  },
  navIcon: { fontSize: 32 },

  // --- 側邊選單樣式 (Sidebar Drawer) ---
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
    backgroundColor: "#FFF",
    zIndex: 101, 
    borderLeftWidth: 2,
    borderLeftColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: -5, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 20,
  },
  badgeContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
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
    fontSize: 19,
    fontWeight: "bold",
  },
  menuItemTextDanger: {
    color: "#E33B3B",
    fontSize: 19,
    fontWeight: "bold",
  },
});