// app/family/_layout.tsx
import { Stack, router, useSegments } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

export default function FamilyLayout() {
  const segments = useSegments() as string[];
  const isChatRoom = segments[segments.length - 1] === "chat-room";

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
      </View>

      {/* 💡 只有在「不是」聊天室的時候才顯示底部導覽列 */}
      {!isChatRoom && (
        <View style={styles.bottomNav}>
          <Pressable onPress={() => router.navigate("/family")}><Text style={styles.navIcon}>🏠</Text></Pressable>
          <Pressable onPress={() => Alert.alert("提示", "行事曆功能建置中")}><Text style={styles.navIcon}>📅</Text></Pressable>
          <Pressable onPress={() => Alert.alert("提示", "通知功能建置中")}><Text style={styles.navIcon}>🔔</Text></Pressable>
          <Pressable onPress={() => router.push("/family/chat-list")}><Text style={styles.navIcon}>💬</Text></Pressable>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  content: { flex: 1 },
  bottomNav: {
    backgroundColor: "#EAEAEA",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 16,
    paddingBottom: 32, // 適應 iPhone 底部海苔條
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
  },
  navIcon: { fontSize: 32 },
});