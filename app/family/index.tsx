import { View, Text, Button } from "react-native";
import { router } from "expo-router";

export default function FamilyHome() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}>
      <Text style={{ fontSize: 26, fontWeight: "600" }}>家屬首頁</Text>
      <Text style={{ opacity: 0.7 }}>流程：查看藥單列表 → 點進詳情</Text>

      <Button title="查看最新藥單" onPress={() => router.push("/family/list")} />
      <Button title="回登入" onPress={() => router.replace("/(auth)/login")} />
    </View>
  );
}
