import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/src/auth/useAuth";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    try {
      setLoading(true);
      await login(email, password);
      router.replace("/"); // 讓 index 做 role 導向
    } catch (e: any) {
      Alert.alert("登入失敗", e?.message ?? "未知錯誤");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 24, gap: 12, justifyContent: "center" }}>
      <Text style={{ fontSize: 28, fontWeight: "800" }}>登入</Text>

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderRadius: 12, padding: 12 }}
      />

      <TextInput
        placeholder="密碼（至少 6 碼）"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, borderRadius: 12, padding: 12 }}
      />

      <Pressable
        onPress={onLogin}
        disabled={loading}
        style={{
          padding: 14,
          borderRadius: 12,
          borderWidth: 1,
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "800" }}>
          {loading ? "登入中…" : "登入"}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.push("/(auth)/register")} style={{ paddingVertical: 6 }}>
        <Text style={{ color: "#007AFF", fontSize: 16, fontWeight: "700" }}>
          沒有帳號？去註冊
        </Text>
      </Pressable>
    </View>
  );
}
