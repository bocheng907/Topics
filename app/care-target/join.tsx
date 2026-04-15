import React, { useMemo, useState } from "react";
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
import { signOut } from "firebase/auth";
import { db,auth } from "@/firebase/firebaseConfig";

export default function CareTargetJoinScreen() {
  const { user } = useAuth();
  const { setActivePatientId } = useActiveCareTarget();
  const [code, setCode] = useState("");

  const normalizedCode = useMemo(() => code.trim().toUpperCase(), [code]);
  const canSubmit = normalizedCode.length >= 4;

  const onJoin = async () => {
    if (!user || !normalizedCode) return;

    try {
      const q = query(
        collection(db, "patients"),
        where("inviteCode", "==", normalizedCode)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        Alert.alert("無效的邀請碼", "請確認邀請碼是否正確。");
        return;
      }

      const foundDoc = snap.docs[0];
      const found = foundDoc.data() as any;

      const roleField = user.role === "family" ? "families" : "caregivers";
      const currentList = Array.isArray(found?.[roleField]) ? found[roleField] : [];

      if (currentList.includes(user.uid)) {
        Alert.alert("提示", "您已經加入過這位長輩了。", [
          {
            text: "前往使用",
            onPress: async () => {
              await setActivePatientId(foundDoc.id);
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

      await setActivePatientId(foundDoc.id);

      Alert.alert("成功加入", `已成功連結到：${found?.name ?? "此照顧對象"}`, [
        {
          text: "開始使用",
          onPress: async () => {
            const home = user.role === "caregiver" ? "/caregiver" : "/family";
            router.replace(home as any);
          },
        },
      ]);
    } catch (e: any) {
      console.log("join patient error:", e);

      if (e?.code === "permission-denied") {
        Alert.alert(
          "加入失敗",
          "目前權限規則不允許用邀請碼查詢照顧對象，請先調整 Firestore Rules。"
        );
        return;
      }

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
        disabled={!canSubmit}
        style={{ backgroundColor: canSubmit ? "#007AFF" : "#CCC", padding: 18, borderRadius: 12 }}
      >
        <Text style={{ color: "#FFF", textAlign: "center", fontWeight: "900", fontSize: 18 }}>
          立即加入
        </Text>
      </Pressable>

      <Pressable
        onPress={async () => {
          try {
            // 1. 強制登出 Firebase Auth 帳號
            await signOut(auth); 
            
            // 2. 清除登入頁面之前的歷史堆疊，強制回到登入頁
            // 💡 根據你的目錄結構，路徑應為 "/(auth)/login"
            router.replace("/(auth)/login"); 
          } catch (error) {
            console.error("登出失敗:", error);
            // 即使登出 API 失敗，通常也建議強制跳轉回登入頁以防卡死
            router.replace("/(auth)/login");
          }
        }}
        style={({ pressed }) => ({
          marginTop: 10,
          padding: 12,
          opacity: pressed ? 0.6 : 1, // 加入簡單的點擊回饋
        })}
      >
        <Text style={{ color: "#666", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
          返回登入頁面
        </Text>
      </Pressable>
    </ScrollView>
  );
}