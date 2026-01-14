import { View, Text, Button } from "react-native";
import { router } from "expo-router";

export default function CaregiverHome() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}>
      <Text style={{ fontSize: 26, fontWeight: "600" }}>看護首頁</Text>
      <Text style={{ opacity: 0.7 }}>流程：拍藥單 → 上傳 → 解析 → 顯示</Text>

      <Button title="拍藥單（拍照/選圖）" onPress={() => router.push("/caregiver/camera")} />
      <Button title="查看藥單紀錄" onPress={() => router.push("/caregiver/list")} />
      <Button title="回登入" onPress={() => router.replace("/(auth)/login")} />
    </View>
  );
}
