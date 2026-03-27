// app/caregiver/index.tsx
import { db } from "@/firebase/firebaseConfig";
import { router } from "expo-router";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";

type CareTarget = {
  id: string;
  name: string;
  notes?: string;
  inviteCode?: string;
  createdAt?: number;
  updatedAt?: number;
};

export default function CaregiverHomeScreen() {
  const { user, logout } = useAuth();
  const { activePatient, activePatientId, ready, clearActivePatient } = useActiveCareTarget();

  const [target, setTarget] = useState<CareTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ total: number; latest?: number }>({
    total: 0,
    latest: undefined,
  });

  // ==========================================
  // 邏輯：防呆與權限檢查 (沒有長輩則去加入)
  // ==========================================
  useEffect(() => {
    if (!ready) return;
    if (!user) return;

    setLoading(true);

    if (!activePatient || !activePatientId) {
      setTarget(null);
      setLoading(false);
      // 看護沒有長輩時，直接導向「加入（輸入邀請碼）」畫面
      router.replace("/care-target/join");
      return;
    }

    setTarget(activePatient as CareTarget);
    setLoading(false);
  }, [ready, user, activePatient, activePatientId]);

  // ==========================================
  // 邏輯：監聽藥單數據
  // ==========================================
  useEffect(() => {
    if (!ready || !user || !activePatientId) {
      setStats({ total: 0, latest: undefined });
      return;
    }

    const q = query(
      collection(db, "prescriptions"),
      where("patientId", "==", activePatientId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => d.data());
        setStats({
          total: rows.length,
          latest: rows[0]?.createdAt,
        });
      },
      (err) => {
        console.log("caregiver home firestore error:", err);
        setStats({ total: 0, latest: undefined });
      }
    );

    return unsub;
  }, [ready, user, activePatientId]);

  // ==========================================
  // 邏輯：右上角設定/登出選單
  // ==========================================
  const onMenuPress = () => {
    Alert.alert("系統選項", "請選擇您要執行的動作", [
      { text: "取消", style: "cancel" },
      { 
        text: "切換 / 解除綁定當前長輩", 
        style: "destructive", 
        onPress: async () => {
          try {
            await clearActivePatient();
            router.replace("/care-target/join");
          } catch (err) {
            console.log("unlink error:", err);
            Alert.alert("解除失敗", "請稍後再試一次");
          }
        } 
      },
      { 
        text: "登出系統", 
        style: "destructive", 
        onPress: async () => {
          try {
            await logout();
            router.replace("/(auth)/login");
          } catch (err) {
            console.log("logout error:", err);
            Alert.alert("登出失敗", "請稍後再試一次");
          }
        } 
      }
    ]);
  };

  if (loading || !ready) return <ActivityIndicator style={{ flex: 1, justifyContent: "center" }} />;

  return (
    <View style={styles.container}>
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ==========================================
            Header 區塊：右上角選單
            ========================================== */}
        <View style={styles.header}>
          <Pressable onPress={onMenuPress} style={styles.menuIcon}>
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
          </Pressable>
        </View>

        {/* ==========================================
            使用者姓名
            ========================================== */}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{target?.name ?? "尚未選擇"}</Text>
        </View>

        {/* ==========================================
            用藥提醒卡片 (🚨 以下目前為假資料排版)
            ========================================== */}
        <View style={styles.reminderCard}>
          <View style={styles.reminderTitleRow}>
            <Text style={styles.emojiLarge}>⏰</Text>
            <Text style={styles.reminderTitle}>14:30 用藥提醒</Text>
          </View>
          
          <View style={styles.reminderSubRow}>
            <Text style={styles.emojiMedium}>💊</Text>
            <Text style={styles.reminderSubText}>飯後服用高血壓藥 (1顆)</Text>
          </View>

          <Pressable style={styles.doneBtn} onPress={() => Alert.alert("提示", "功能建置中")}>
            <Text style={styles.doneBtnText}>DONE</Text>
          </Pressable>
        </View>

        {/* ==========================================
            功能選單標題
            ========================================== */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>功能選單</Text>
        </View>

        {/* ==========================================
            主要按鈕：掃描藥單 (✅ 已接上 camera.tsx)
            ========================================== */}
        <Pressable 
          onPress={() => router.push("/caregiver/camera")} 
          style={styles.mainActionButton}
        >
          <Text style={styles.mainActionEmoji}>📷</Text>
          <Text style={styles.mainActionText}>掃描藥單</Text>
        </Pressable>

        {/* ==========================================
            2x2 功能網格
            ========================================== */}
        <View style={styles.gridContainer}>
          <View style={styles.gridRow}>
            {/* 查看藥單紀錄 (✅ 已接上 list.tsx) */}
            <Pressable 
              onPress={() => router.push("/caregiver/list")} 
              style={[styles.gridItem, { backgroundColor: '#F4E770' }]}
            >
              <Text style={styles.gridEmoji}>📋</Text>
              <Text style={styles.gridText}>查看藥單紀錄</Text>
            </Pressable>
            
            {/* 每日健康回報 */}
            <Pressable 
              onPress={() => router.push("/caregiver/health-report" as any)} 
              style={[styles.gridItem, { backgroundColor: '#EEAC6F' }]}
            >
              <Text style={styles.gridEmoji}>🩺</Text>
              <Text style={styles.gridText}>每日健康回報</Text>
            </Pressable>
          </View>

          <View style={styles.gridRow}>
            {/* 溝通語音圖卡 */}
            <Pressable 
              onPress={() => router.push("/caregiver/communication-cards" as any)} 
              style={[styles.gridItem, { backgroundColor: '#81E87A' }]}
            >
              <Text style={styles.gridEmoji}>🖼️</Text>
              <Text style={styles.gridText}>溝通語音圖卡</Text>
            </Pressable>
            
            {/* 狀況錄影 */}
            <Pressable 
              onPress={() => router.push("/caregiver/video-record" as any)} 
              style={[styles.gridItem, { backgroundColor: '#7BC6F9' }]}
            >
              <Text style={styles.gridEmoji}>📹</Text>
              <Text style={styles.gridText}>狀況錄影</Text>
            </Pressable>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

// ==========================================
// 樣式表 (Tailwind to RN StyleSheet)
// ==========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingBottom: 80, // 💡 縮小了底部的留白，避免干擾 Layout 佈局，但確保能滑過電話
    paddingTop: 60, // 避開手機狀態列
  },
  // --- Header ---
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  menuIcon: {
    height: 28,
    width: 40,
    justifyContent: "space-around",
  },
  menuLine: {
    height: 6,
    width: "100%",
    backgroundColor: "#000",
    borderRadius: 3,
  },
  // --- User Info ---
  userInfo: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  userName: {
    fontSize: 38,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#000",
  },
  // --- Reminder Card ---
  reminderCard: {
    backgroundColor: "#F7F7F7",
    marginHorizontal: 20,
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  reminderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    width: "100%",
    justifyContent: "center",
  },
  emojiLarge: {
    fontSize: 36,
  },
  reminderTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#000",
    letterSpacing: 1,
  },
  reminderSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
    width: "100%",
    justifyContent: "center",
  },
  emojiMedium: {
    fontSize: 28,
  },
  reminderSubText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#000",
  },
  doneBtn: {
    width: 110,
    height: 110,
    backgroundColor: "#D9D9D9",
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  doneBtnText: {
    fontSize: 24,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 1,
  },
  // --- Sections ---
  sectionHeader: {
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
  },
  // --- Main Action Button ---
  mainActionButton: {
    backgroundColor: "#4651DB",
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  mainActionEmoji: {
    fontSize: 24,
  },
  mainActionText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFF",
    letterSpacing: 1,
  },
  // --- Grid ---
  gridContainer: {
    marginHorizontal: 20,
    gap: 16,
  },
  gridRow: {
    flexDirection: "row",
    gap: 16,
  },
  gridItem: {
    flex: 1,
    height: 120,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  gridEmoji: {
    fontSize: 42,
    marginBottom: 8,
  },
  gridText: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#000",
  }
});