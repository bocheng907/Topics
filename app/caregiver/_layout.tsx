// app/caregiver/_layout.tsx
import { Stack, router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

export default function CaregiverLayout() {
  return (
    <View style={styles.container}>
      {/* 1. 上方的畫面區域 */}
      <View style={styles.content}>
        <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
      </View>

      {/* 2. 將 FAB 與導覽列包在一起，確保相對位置永遠絕對精準 */}
      <View style={styles.footerWrapper}>
        
        {/* 懸浮紅色電話按鈕 (FAB) - 嚴格依照設計圖，半疊加在導覽列上 */}
        <View style={styles.fabContainer}>
          <Pressable 
            style={styles.fabButton}
            onPress={() => Alert.alert("緊急聯絡", "即將撥打給家屬...")}
          >
            <Text style={styles.fabIcon}>📞</Text>
          </Pressable>
        </View>

        {/* 底部導覽列 */}
        <View style={styles.bottomNav}>
          <Pressable onPress={() => router.navigate("/caregiver")}>
            <Text style={styles.navIcon}>🏠</Text>
          </Pressable>
          
          <Pressable onPress={() => Alert.alert("提示", "行事曆功能建置中")}>
            {/* paddingRight: 48 完美對應 Canvas 的 pr-12，讓出空間給電話 */}
            <Text style={[styles.navIcon, { paddingRight: 48 }]}>📅</Text>
          </Pressable>
          
          <Pressable onPress={() => Alert.alert("提示", "通知功能建置中")}>
            {/* paddingLeft: 48 完美對應 Canvas 的 pl-12，讓出空間給電話 */}
            <Text style={[styles.navIcon, { paddingLeft: 48 }]}>🔔</Text>
          </Pressable>
          
          <Pressable onPress={() => Alert.alert("提示", "訊息功能建置中")}>
            <Text style={styles.navIcon}>💬</Text>
          </Pressable>
        </View>
        
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  content: { flex: 1 },
  footerWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  fabContainer: {
    position: "absolute",
    bottom: 45, // 💡 嚴格恢復成 Canvas 的 bottom-[45px]
    left: 0,
    right: 0,
    alignItems: "center", // 💡 放棄 left:50%，改用最外層置中，保證在任何手機都不會跑掉
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
    transform: [{ rotate: "-15deg" }], // 傾斜電話圖示
  },
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
});