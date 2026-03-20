import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/src/auth/useAuth";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";

export default function CareTargetJoinScreen() {
  const { user } = useAuth();
  const { setActiveCareTargetId } = useActiveCareTarget();
  const [code, setCode] = useState("");

  const onJoin = async () => {
    if (!user || !code.trim()) return;

    try {
      const inputCode = code.trim().toUpperCase();

      const q = query(
        collection(db, "patients"),
        where("inviteCode", "==", inputCode)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        Alert.alert("無效的邀請碼", "請確認邀請碼是否正確。");
        return;
      }

      const foundDoc = snap.docs[0];
      const found = foundDoc.data() as any;

      const roleField = user.role === "family" ? "families" : "caregivers";
      const currentList = Array.isArray(found[roleField]) ? found[roleField] : [];

      if (currentList.includes(user.uid)) {
        Alert.alert("提示", "您已經加入過這位長輩了。", [
          {
            text: "前往使用",
            onPress: async () => {
              await setActiveCareTargetId(foundDoc.id);
              const home = user.role === "caregiver" ? "/caregiver" : "/family";
              router.replace(home as any);
            },
          },
        ]);
        return;
      }

      await updateDoc(doc(db, "patients", foundDoc.id), {
        [roleField]: arrayUnion(user.uid),
      });

      Alert.alert("成功加入", `已成功連結到：${found.name ?? "此照顧對象"}`, [
        {
          text: "開始使用",
          onPress: async () => {
            await setActiveCareTargetId(foundDoc.id);
            const home = user.role === "caregiver" ? "/caregiver" : "/family";
            router.replace(home as any);
          },
        },
      ]);
    } catch (e) {
      console.log("join patient error:", e);
      Alert.alert("加入失敗", "請稍後再試一次");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 90, gap: 24 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: "900" }}>加入照顧對象</Text>
        <Text style={{ fontSize: 16, color: "#666" }}>請向其他護理人員或家屬索取邀請碼</Text>
      </View>

      <View style={{ gap: 12 }}>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="請輸入 6-8 碼邀請碼"
          autoCapitalize="characters"
          style={{
            borderWidth: 1,
            borderColor: "#007AFF",
            borderRadius: 12,
            padding: 20,
            fontSize: 24,
            fontWeight: "800",
            textAlign: "center",
            letterSpacing: 4,
            backgroundColor: "#F9FBFF",
          }}
        />
      </View>

      <Pressable
        onPress={onJoin}
        disabled={code.length < 4}
        style={{ backgroundColor: code.length >= 4 ? "#007AFF" : "#CCC", padding: 18, borderRadius: 12 }}
      >
        <Text style={{ color: "#FFF", textAlign: "center", fontWeight: "900", fontSize: 18 }}>
          立即加入
        </Text>
      </Pressable>

      <Pressable onPress={() => router.back()}>
        <Text style={{ color: "#666", textAlign: "center", fontWeight: "700" }}>返回</Text>
      </Pressable>
    </ScrollView>
  );
}