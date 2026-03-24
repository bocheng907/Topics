// app/family/index.tsx
import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

export default function FamilyHomeScreen() {
  const { logout } = useAuth();
  const { 
    ready, 
    activePatient, 
    activePatientId, 
    linkedCareTargets, 
    setActivePatientId, 
    clearActivePatient 
  } = useActiveCareTarget();

  // ==========================================
  // 邏輯：防呆與權限檢查
  // ==========================================
  useEffect(() => {
    if (!ready) return;
    // 如果沒有半個長輩，強制去建立
    if (linkedCareTargets.length === 0) {
      router.replace("/care-target/create");
    }
  }, [ready, linkedCareTargets.length]);

  // ==========================================
  // 邏輯：複製邀請碼
  // ==========================================
  const copyInviteCode = async () => {
    if (activePatient?.inviteCode) {
      await Clipboard.setStringAsync(activePatient.inviteCode);
      Alert.alert("已複製", "邀請碼已複製到剪貼簿");
    }
  };

  // ==========================================
  // 邏輯：右上角設定/登出選單 (綁定在右上角漢堡圖標)
  // ==========================================
  const onMenuPress = () => {
    Alert.alert("系統選項", "請選擇您要執行的動作", [
      { text: "取消", style: "cancel" },
      { 
        text: "解除綁定當前長輩", 
        style: "destructive", 
        onPress: async () => await clearActivePatient() 
      },
      { 
        text: "登出系統", 
        style: "destructive", 
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        } 
      }
    ]);
  };

  if (!ready || linkedCareTargets.length === 0) {
    return <ActivityIndicator style={{ flex: 1, justifyContent: "center" }} />;
  }

  return (
    <View style={styles.container}>
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ==========================================
            Header 區塊：長輩切換頭像列
            ========================================== */}
        <View style={styles.header}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarList}>
            
            {/* 動態渲染綁定的長輩 */}
            {linkedCareTargets.map((target) => {
              const isActive = target.id === activePatientId;
              return (
                <Pressable key={target.id} onPress={() => setActivePatientId(target.id)}>
                  <View style={[styles.avatar, isActive ? styles.avatarActive : styles.avatarInactive]}>
                    <Text style={[styles.avatarText, isActive ? styles.textWhite : styles.textGray]}>
                      {target.name ? target.name.charAt(0) : "?"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            {/* 新增長輩按鈕 */}
            <Pressable onPress={() => router.push("/care-target/create")}>
              <View style={styles.avatarAdd}>
                <Text style={styles.avatarAddText}>+</Text>
              </View>
            </Pressable>
            
          </ScrollView>

          {/* 右上角選單按鈕 (解除綁定/登出) */}
          <Pressable onPress={onMenuPress} style={styles.menuIcon}>
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
          </Pressable>
        </View>

        {/* ==========================================
            使用者資訊區塊 (姓名 + 邀請碼)
            ========================================== */}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{activePatient?.name ?? "尚未選擇"}</Text>
          
          <View style={styles.inviteBadge}>
            <Text style={styles.inviteText}>邀請碼:{activePatient?.inviteCode ?? "無"}</Text>
          </View>
          
          {/* 複製按鈕 (重現設計圖的重疊方框) */}
          <Pressable onPress={copyInviteCode} style={styles.copyIconWrap}>
            <View style={styles.copyIconBack} />
            <View style={styles.copyIconFront} />
          </Pressable>
        </View>

        {/* ==========================================
            今日用藥進度卡片 (🚨 以下目前為假資料)
            ========================================== */}
        <View style={styles.medCard}>
          <Text style={styles.medTitle}>今日用藥進度</Text>
          <Text style={styles.medProgress}>已服用 2/3 次</Text>
          <Text style={styles.medDetail}>14:30 飯後高血壓藥 (已確認 ✅)</Text>
        </View>

        {/* ==========================================
            生理數據卡片 (🚨 以下目前為假資料)
            ========================================== */}
        <View style={styles.vitalsCard}>
          <View style={styles.vitalsRow}>
            
            {/* 體溫 */}
            <View style={styles.vitalCol}>
              <Text style={styles.vitalTitle}>體溫</Text>
              <View style={styles.vitalBox}>
                <View style={[styles.vitalTop, { backgroundColor: '#FA7474' }]}>
                  <Text style={styles.vitalValue}>37</Text>
                  <Text style={styles.vitalUnit}>°C</Text>
                </View>
                <View style={[styles.vitalBottom, { backgroundColor: '#987A7A' }]}>
                  <Text style={styles.vitalTime}>8:00</Text>
                  <Text style={styles.vitalDate}>今日</Text>
                </View>
              </View>
            </View>

            {/* 心跳 */}
            <View style={styles.vitalCol}>
              <Text style={styles.vitalTitle}>心跳</Text>
              <View style={styles.vitalBox}>
                <View style={[styles.vitalTop, { backgroundColor: '#D4D4D4' }]}>
                  <Text style={styles.vitalValue}>85</Text>
                  <Text style={styles.vitalUnit}>bpm</Text>
                </View>
                <View style={[styles.vitalBottom, { backgroundColor: '#8E8E8E' }]}>
                  <Text style={styles.vitalTime}>8:00</Text>
                  <Text style={styles.vitalDate}>昨天</Text>
                </View>
              </View>
            </View>

            {/* 血壓 */}
            <View style={styles.vitalCol}>
              <Text style={styles.vitalTitle}>血壓</Text>
              <View style={styles.vitalBox}>
                <View style={[styles.vitalTop, { backgroundColor: '#7AEE90', paddingVertical: 4 }]}>
                  <Text style={styles.vitalValueSm}>120</Text>
                  <Text style={styles.vitalValueSm}>80</Text>
                  <Text style={styles.vitalUnitXs}>mmhg</Text>
                </View>
                <View style={[styles.vitalBottom, { backgroundColor: '#849F84' }]}>
                  <Text style={styles.vitalTime}>8:00</Text>
                  <Text style={styles.vitalDate}>今日</Text>
                </View>
              </View>
            </View>

            {/* 血糖 */}
            <View style={styles.vitalCol}>
              <Text style={styles.vitalTitle}>血糖</Text>
              <View style={styles.vitalBox}>
                <View style={[styles.vitalTop, { backgroundColor: '#D4D4D4' }]}>
                  <Text style={[styles.vitalValueSm, { marginTop: 4 }]}>90</Text>
                  <Text style={styles.vitalUnitXs}>飯前</Text>
                  <Text style={styles.vitalUnitXs}>mg/dl</Text>
                </View>
                <View style={[styles.vitalBottom, { backgroundColor: '#8E8E8E' }]}>
                  <Text style={styles.vitalTime}>16:30</Text>
                  <Text style={styles.vitalDate}>3月16日</Text>
                </View>
              </View>
            </View>

          </View>

          {/* 查看圖表按鈕 (✅ 已綁定跳轉) */}
          <Pressable onPress={() => router.push("/family/dashboard")} style={styles.chartBtn}>
            <Text style={styles.chartBtnText}>查看圖表 📊</Text>
          </Pressable>
        </View>

        {/* ==========================================
            底部三大功能按鈕 (✅ 已綁定跳轉路徑)
            ========================================== */}
        <View style={styles.actionsRow}>
          <Pressable onPress={() => router.push("/family/list")} style={[styles.actionBtn, { backgroundColor: '#FCE671' }]}>
            <Text style={styles.actionEmoji}>📋</Text>
            <Text style={styles.actionText}>藥單紀錄</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/family/condition")} style={[styles.actionBtn, { backgroundColor: '#85C6F9' }]}>
            <Text style={styles.actionEmoji}>📹</Text>
            <Text style={styles.actionText}>狀況查看</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/family/voice")} style={[styles.actionBtn, { backgroundColor: '#85E785' }]}>
            <Text style={styles.actionEmoji}>🎙️</Text>
            <Text style={styles.actionText}>錄製語音</Text>
          </Pressable>
        </View>

      </ScrollView>

      {/* ==========================================
          底部導覽列
          (備註: 未來建議移至 app/family/_layout.tsx 以支援全域切換)
          ========================================== */}
      <View style={styles.bottomNav}>
        <Pressable><Text style={styles.navIcon}>🏠</Text></Pressable>
        <Pressable><Text style={styles.navIcon}>📅</Text></Pressable>
        <Pressable><Text style={styles.navIcon}>🔔</Text></Pressable>
        <Pressable><Text style={styles.navIcon}>💬</Text></Pressable>
      </View>

    </View>
  );
}

// ==========================================
// 樣式表 (將 Tailwind 完美轉譯為 RN StyleSheet)
// ==========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingBottom: 120, // 避免內容被底部導覽列遮擋
    paddingTop: 60, // 避開手機狀態列(瀏海)
  },
  // --- Header ---
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  avatarList: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarActive: {
    backgroundColor: "#000", // 設計圖當前選中的是深色嗎？我先設定預設凸顯色
  },
  avatarInactive: {
    backgroundColor: "#D9D9D9",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "bold",
  },
  textWhite: { color: "#FFF" },
  textGray: { color: "#666" },
  avatarAdd: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarAddText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 4,
  },
  menuIcon: {
    height: 28,
    width: 36,
    justifyContent: "space-around",
    marginLeft: 16,
  },
  menuLine: {
    height: 4,
    width: "100%",
    backgroundColor: "#000",
    borderRadius: 2,
  },
  // --- User Info ---
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  userName: {
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#000",
    marginRight: 12,
  },
  inviteBadge: {
    backgroundColor: "#E5E5E5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 12,
  },
  inviteText: {
    color: "#4B5563", // Tailwind gray-600
    fontWeight: "600",
    fontSize: 14,
  },
  copyIconWrap: {
    width: 24,
    height: 24,
    position: "relative",
  },
  copyIconBack: {
    position: "absolute",
    top: 2,
    left: 2,
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: "#000",
    borderRadius: 4,
  },
  copyIconFront: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: "#000",
    borderRadius: 4,
    backgroundColor: "#FFF",
  },
  // --- Med Card ---
  medCard: {
    backgroundColor: "#F7F7F7",
    marginHorizontal: 20,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  medTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    color: "#000",
    letterSpacing: 1,
    marginBottom: 8,
  },
  medProgress: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    color: "#000",
    marginBottom: 12,
  },
  medDetail: {
    fontSize: 16,
    textAlign: "center",
    color: "#000",
    fontWeight: "500",
  },
  // --- Vitals Card ---
  vitalsCard: {
    backgroundColor: "#F2F2F2",
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  vitalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  vitalCol: {
    flex: 1,
    alignItems: "center",
  },
  vitalTitle: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#000",
    letterSpacing: 2,
    marginBottom: 8,
  },
  vitalBox: {
    width: "100%",
    height: 130,
    borderRadius: 12,
    overflow: "hidden",
  },
  vitalTop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  vitalBottom: {
    height: 46,
    justifyContent: "center",
    alignItems: "center",
  },
  vitalValue: {
    fontSize: 34,
    fontWeight: "600",
    color: "#000",
    lineHeight: 38,
  },
  vitalValueSm: {
    fontSize: 26,
    fontWeight: "600",
    color: "#000",
    lineHeight: 30,
  },
  vitalUnit: {
    fontSize: 14,
    color: "#000",
  },
  vitalUnitXs: {
    fontSize: 12,
    color: "#000",
  },
  vitalTime: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
  vitalDate: {
    color: "#F3F4F6", // Tailwind gray-100
    fontSize: 12,
  },
  chartBtn: {
    backgroundColor: "#F5A623",
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignSelf: "center",
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chartBtnText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "bold",
  },
  // --- Actions Row ---
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginHorizontal: 20,
    marginTop: 20,
  },
  actionBtn: {
    flex: 1,
    aspectRatio: 1, // 保持正方形
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  actionEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#000",
    letterSpacing: 1,
  },
  // --- Bottom Nav ---
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#EAEAEA",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 16,
    paddingBottom: 32, // 適應 iPhone 底部海苔條
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  navIcon: {
    fontSize: 32,
  }
});