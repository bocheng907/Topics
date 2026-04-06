import { auth, db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

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

    // 依目前 rules：只有 family 可以建立 patient
    if (user.role !== "family") {
      Alert.alert("無法建立", "目前只有家屬帳號可以新增照顧對象，請改用邀請碼加入現有資料。");
      return;
    }

    const trimmedName = name.trim();
    const trimmedNotes = notes.trim();

    if (!trimmedName) {
      Alert.alert("提醒", "請先輸入長輩姓名/稱呼");
      return;
    }

    const code = genInviteCode();

    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const hh = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");

      const timeString = `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
      const shortId = user.uid.slice(-4); // 取 user uid 最後4碼防撞
      const customDocId = `${timeString}_pat_${shortId}`;

      const payload = {
        name: trimmedName,
        notes: trimmedNotes,
        inviteCode: code,
        caregivers: [],
        families: [user.uid],
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      };

      const patientRef = doc(db, "patients", customDocId);
      await setDoc(patientRef, payload);

      try {
        const q = query(
          collection(db, "users"),
          where("uid", "==", user.uid)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          throw new Error("user not found");
        }

        const userDocRef = doc(db, "users", snap.docs[0].id);

        await updateDoc(userDocRef, {
          activePatientId: customDocId,
        });
      } catch (e) {
        console.log("sync activePatientId error:", e);
      }

      Alert.alert("建立成功", `已建立 ${trimmedName} 的資料庫。\n邀請碼：${code}`, [
        {
          text: "複製並進入主畫面",
          onPress: async () => {
            await Clipboard.setStringAsync(code);
            router.replace("/family"); // 👈 改成跳轉到 /family
          },
        },
      ]);
    } catch (e: any) {
      console.log("create patient error:", e);

      if (e?.code === "permission-denied") {
        Alert.alert("建立失敗", "你目前沒有建立照顧對象的權限。");
        return;
      }

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

      {/* 🟢 終極解法：先登出，再換頁！ */}
      <Pressable 
        onPress={async () => {
          try {
            await signOut(auth); // 1. 真正登出 Firebase 帳號
            router.replace("/login"); // 2. 登出後再跳回登入頁
          } catch (error) {
            console.error("登出失敗:", error);
          }
        }}
      > 
        <Text style={{ color: "#666", textAlign: "center", fontWeight: "700" }}>登出並返回</Text>
      </Pressable>
    </ScrollView>
  );
}