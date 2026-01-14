import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/src/auth/useAuth";
import type { Role } from "@/src/auth/AuthProvider";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("caregiver");
  const [loading, setLoading] = useState(false);

  async function onRegister() {
    try {
      setLoading(true);
      await register(email, password, role);
      router.replace("/"); // 讓 index 做 role 導向
    } catch (e: any) {
      Alert.alert("註冊失敗", e?.message ?? "未知錯誤");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 24, gap: 12, justifyContent: "center" }}>
      <Text style={{ fontSize: 28, fontWeight: "800" }}>註冊</Text>

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

      {/* 角色切換 */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={() => setRole("caregiver")}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            alignItems: "center",
            opacity: role === "caregiver" ? 1 : 0.5,
          }}
        >
          <Text style={{ fontWeight: "800" }}>看護</Text>
        </Pressable>

        <Pressable
          onPress={() => setRole("family")}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            alignItems: "center",
            opacity: role === "family" ? 1 : 0.5,
          }}
        >
          <Text style={{ fontWeight: "800" }}>家屬</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onRegister}
        disabled={loading}
        style={{
          padding: 14,
          borderRadius: 12,
          borderWidth: 1,
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "800" }}>
          {loading ? "註冊中…" : "建立帳號"}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.back()} style={{ paddingVertical: 6 }}>
        <Text style={{ color: "#007AFF", fontSize: 16, fontWeight: "700" }}>
          回登入
        </Text>
      </Pressable>
    </View>
  );
}
