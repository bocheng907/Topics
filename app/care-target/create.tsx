import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/src/auth/useAuth";
import * as Clipboard from "expo-clipboard";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";

function genInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function CareTargetCreateScreen() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  const onCreate = async () => {
    if (!user) return;

    const trimmedName = name.trim();
    const trimmedNotes = notes.trim();

    if (!trimmedName) {
      Alert.alert("提醒", "請先輸入長輩姓名/稱呼");
      return;
    }

    const code = genInviteCode();

    try {
      await addDoc(collection(db, "patients"), {
        name: trimmedName,
        notes: trimmedNotes,
        inviteCode: code,
        caregivers: user.role === "caregiver" ? [user.uid] : [],
        families: user.role === "family" ? [user.uid] : [],
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });

      Alert.alert("建立成功", `已建立 ${trimmedName} 的資料庫。\n邀請碼：${code}`, [
        {
          text: "複製並返回",
          onPress: async () => {
            await Clipboard.setStringAsync(code);
            router.replace("/care-target/select");
          },
        },
      ]);
    } catch (e) {
      console.log("create patient error:", e);
      Alert.alert("建立失敗", "請稍後再試一次");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 90, gap: 20 }}>
      <Text style={{ fontSize: 28, fontWeight: "900" }}>新增照顧對象</Text>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: "#444" }}>長輩姓名/稱呼</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="例如：王爺爺"
          style={{
            borderWidth: 1,
            borderColor: "#DDD",
            borderRadius: 12,
            padding: 16,
            fontSize: 16,
            backgroundColor: "#FFF",
          }}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: "#444" }}>注意事項 (選填)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="例如：對普拿疼過敏"
          multiline
          numberOfLines={4}
          style={{
            borderWidth: 1,
            borderColor: "#DDD",
            borderRadius: 12,
            padding: 16,
            fontSize: 16,
            backgroundColor: "#FFF",
            height: 120,
            textAlignVertical: "top",
          }}
        />
      </View>

      <Pressable
        onPress={onCreate}
        disabled={!name.trim()}
        style={{
          backgroundColor: name.trim() ? "#007AFF" : "#CCC",
          padding: 18,
          borderRadius: 12,
          marginTop: 10,
        }}
      >
        <Text style={{ color: "#FFF", textAlign: "center", fontWeight: "900", fontSize: 18 }}>
          確認建立
        </Text>
      </Pressable>

      <Pressable onPress={() => router.back()}>
        <Text style={{ color: "#666", textAlign: "center", fontWeight: "700" }}>返回</Text>
      </Pressable>
    </ScrollView>
  );
}