import { auth, db } from "@/firebase/firebaseConfig"; // 🌟 新增：引入 auth
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useSegments } from "expo-router";
import { signOut } from "firebase/auth"; // 🌟 新增：引入 Firebase 登出功能
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, Dimensions, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = SCREEN_WIDTH * 0.55; 

export default function CaregiverLayout() {
  const segments = useSegments() as string[];
  const currentPage = segments[segments.length - 1];
  const insets = useSafeAreaInsets(); 

  const hideBottomNavRoutes = [
    "chat-room", 
    "detail", 
    "edit", 
    "camera",
    "list", 
    "video-record",
    "health-report",        
    "communication-cards"   
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

  const activeCareTarget = useActiveCareTarget();
  const activePatientId =
    (activeCareTarget as any)?.activePatientId ??
    (activeCareTarget as any)?.activeCareTargetId ??
    "";

  async function makePhoneCall(phone: string) {
    try {
      const url = `tel:${phone}`;
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("撥號失敗", "此裝置目前無法開啟撥號功能");
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      console.log("phone call failed:", e);
      Alert.alert("撥號失敗", "目前無法撥打這支電話");
    }
  }

  async function onEmergencyCall() {
    if (!activePatientId) {
      Alert.alert("提醒", "目前沒有選擇照顧對象");
      return;
    }
    try {
      const patientSnap = await getDoc(doc(db, "patients", activePatientId));
      if (!patientSnap.exists()) {
        Alert.alert("錯誤", "找不到照顧對象資料");
        return;
      }
      const data = patientSnap.data() as any;
      const phone1 = String(data.emergencyPhone1 ?? "").trim();
      const phone2 = String(data.emergencyPhone2 ?? "").trim();
      const phones = [phone1, phone2].filter(Boolean);

      if (phones.length === 0) {
        Alert.alert("尚未設定", "這位長輩尚未設定緊急聯絡電話");
        return;
      }
      if (phones.length === 1) {
        await makePhoneCall(phones[0]);
        return;
      }
      Alert.alert("選擇要撥打的電話", "請選擇緊急聯絡人", [
        { text: `聯絡電話 1：${phones[0]}`, onPress: () => void makePhoneCall(phones[0]) },
        { text: `聯絡電話 2：${phones[1]}`, onPress: () => void makePhoneCall(phones[1]) },
        { text: "取消", style: "cancel" },
      ]);
    } catch (e) {
      console.log("emergency call failed:", e);
      Alert.alert("撥號失敗", "目前無法撥打緊急聯絡電話");
    }
  }

  // 🌟 真實的登出邏輯
  const handleLogout = () => {
    Alert.alert("登出系統", "確定要登出目前帳號嗎？", [
      { text: "取消", style: "cancel" },
      { 
        text: "確定登出", 
        style: "destructive", 
        onPress: async () => {
          try {
            await signOut(auth); // 呼叫 Firebase 登出
            setIsSidebarOpen(false); // 關閉側邊欄
            router.replace("/"); // 🌟 使用 replace 清除歷史紀錄，退回最外層的登入頁
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
      {/* ================= 主畫面區塊 ================= */}
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

      {/* ================= 全域底部導覽列 ================= */}
      {!hideBottomNav && (
        <View style={styles.footerWrapper}>
          <View style={styles.fabContainer}>
            <Pressable style={styles.fabButton} onPress={onEmergencyCall}>
              <Text style={styles.fabIcon}>📞</Text>
            </Pressable>
          </View>

          <View style={styles.bottomNav}>
            <Pressable onPress={() => router.navigate("/caregiver" as any)}>
              <Text style={styles.navIcon}>🏠</Text>
            </Pressable>
            <Pressable onPress={() => Alert.alert("提示", "行事曆功能建置中")}>
              <Text style={[styles.navIcon, { paddingRight: 48 }]}>📅</Text>
            </Pressable>
            <Pressable onPress={() => Alert.alert("提示", "通知功能建置中")}>
              <Text style={[styles.navIcon, { paddingLeft: 48 }]}>🔔</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/caregiver/chat-list" as any)}>
              <Text style={styles.navIcon}>💬</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ================= 側邊選單 (Sidebar) ================= */}
      <Animated.View 
        pointerEvents={isSidebarOpen ? "auto" : "none"} 
        style={[StyleSheet.absoluteFillObject, styles.overlay, { opacity: overlayOpacity }]}
      >
        <Pressable style={{ flex: 1 }} onPress={() => setIsSidebarOpen(false)} />
      </Animated.View>

      <Animated.View 
        style={[
          styles.drawer, 
          { 
            transform: [{ translateX }], 
            paddingTop: insets.top + 40 
          }
        ]}
      >
        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>看護模式</Text>
          </View>
        </View>

        <View style={styles.menuContainer}>
          <Pressable style={styles.menuItem} onPress={() => Alert.alert("提示", "語言切換開發中")}>
            <Text style={styles.menuItemText}>語言</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => Alert.alert("提示", "記事本開發中")}>
            <Text style={styles.menuItemText}>記事本</Text>
          </Pressable>
          
          <Pressable style={styles.menuItem} onPress={() => Alert.alert("警告", "確定要解除連結嗎？")}>
            <Text style={styles.menuItemTextDanger}>解除連結</Text>
          </Pressable>
          
          {/* 🌟 綁定真實登出邏輯 */}
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
  
  hamburgerBtn: {
    position: "absolute",
    right: 20,
    zIndex: 40, 
    padding: 8,
  },

  footerWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  fabContainer: {
    position: "absolute",
    bottom: 45,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 50,
  },
  fabButton: {
    width: 80,
    height: 80,
    backgroundColor: "#EF3E3E",
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#EF3E3E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 40,
    marginLeft: 4,
    transform: [{ rotate: "-15deg" }],
  },
  bottomNav: {
    backgroundColor: "#EAEAEA",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
    zIndex: 10,
  },
  navIcon: { fontSize: 32 },

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
    backgroundColor: "#52D052",
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