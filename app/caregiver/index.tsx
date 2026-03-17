import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack } from "expo-router";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";

import { useAuth } from "@/src/auth/useAuth";

type CareTarget = {
  id: string;
  name: string;
  notes?: string;
  inviteCode: string;
  createdAt: number;
};

const KEY_CARE_TARGETS = "careapp_careTargets_v1";
const activeKey = (uid: string) => `careapp_activeCareTarget_v1:${uid}`;

function formatTime(ts?: number) {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function CaregiverHomeScreen() {
  const { user, logout } = useAuth();
  const [target, setTarget] = useState<CareTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ total: number; latest?: number }>({
    total: 0,
    latest: undefined,
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const activeId = await AsyncStorage.getItem(activeKey(user.uid));
        if (!activeId) {
          router.replace("/care-target/select");
          return;
        }
        const raw = await AsyncStorage.getItem(KEY_CARE_TARGETS);
        if (raw) {
          const all: CareTarget[] = JSON.parse(raw);
          const found = all.find((it) => it.id === activeId);
          if (found) setTarget(found);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!user || !target?.id) {
      setStats({ total: 0, latest: undefined });
      return;
    }

    const q = query(
      collection(db, "prescriptions"),
      where("caregiverUid", "==", user.uid),
      where("careTargetId", "==", target.id),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() as any;
          let createdAt: number | undefined = undefined;

          if (data.createdAt?.toMillis) {
            createdAt = data.createdAt.toMillis();
          } else if (data.createdAt?.seconds) {
            createdAt = data.createdAt.seconds * 1000;
          } else if (typeof data.createdAt === "number") {
            createdAt = data.createdAt;
          }

          return { createdAt };
        });

        setStats({
          total: rows.length,
          latest: rows[0]?.createdAt,
        });
      },
      (err) => {
        console.log("caregiver home firestore error:", err);
        setStats({ total: 0, latest: undefined });
        Alert.alert("讀取失敗", "無法讀取雲端藥單紀錄，請檢查 Firestore 索引或權限設定。");
      }
    );

    return unsub;
  }, [user, target?.id]);

  const onUnlink = async () => {
    if (!target || !user) return;
    Alert.alert("安全提醒", `確定要解除與「${target.name}」的連結嗎？`, [
      { text: "取消", style: "cancel" },
      {
        text: "確定解除",
        style: "destructive",
        onPress: async () => {
          const rawLinks = await AsyncStorage.getItem("careapp_careTarget_links_v1");
          const allLinks = rawLinks ? JSON.parse(rawLinks) : {};
          allLinks[user.uid] = (allLinks[user.uid] || []).filter((id: any) => id !== target.id);
          await AsyncStorage.setItem("careapp_careTarget_links_v1", JSON.stringify(allLinks));
          await AsyncStorage.removeItem(activeKey(user.uid));
          router.replace("/care-target/select");
        }
      }
    ]);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 90, gap: 20 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 28, fontWeight: "900", color: "#333" }}>照顧控制台</Text>
        <Text style={{ fontSize: 16, color: "#666" }}>你好，{user?.email?.split('@')[0] || '看護人員'}</Text>
      </View>

      <View style={{ backgroundColor: "#F2F2F7", borderRadius: 20, padding: 20, gap: 12, borderWidth: 1, borderColor: "#EEE" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#666" }}>當前照顧對象</Text>
          <View style={{ backgroundColor: "#34C759", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
            <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "800" }}>看護模式</Text>
          </View>
        </View>

        <Text style={{ fontSize: 32, fontWeight: "900", color: "#007AFF" }}>
          {target?.name ?? "尚未選擇"}
        </Text>

        <View style={{ height: 1, backgroundColor: "#DDD" }} />

        <View style={{ gap: 6 }}>
          <Text style={{ color: "#444", fontWeight: "700" }}>📊 累積紀錄：{stats.total} 筆</Text>
          <Text style={{ color: "#444", fontWeight: "700" }}>🕒 最後更新：{formatTime(stats.latest)}</Text>
        </View>

        <View style={{ backgroundColor: "#E1E9FF", padding: 14, borderRadius: 12, marginTop: 4 }}>
          <Text style={{ fontSize: 14, fontWeight: "900", color: "#007AFF", marginBottom: 4 }}>⚠️ 注意事項 / 備註：</Text>
          <Text style={{ fontSize: 15, color: "#333", lineHeight: 22 }}>
            {target?.notes && target.notes.trim() !== "" ? target.notes : "暫無填寫注意事項"}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <Pressable
            onPress={() => router.replace("/care-target/select")}
            style={{ flex: 1, paddingVertical: 12, backgroundColor: "#FFF", borderRadius: 12, borderWidth: 1, borderColor: "#007AFF" }}
          >
            <Text style={{ color: "#007AFF", fontWeight: "800", textAlign: "center" }}>切換長輩</Text>
          </Pressable>
          <Pressable
            onPress={onUnlink}
            style={{ flex: 1, paddingVertical: 12, backgroundColor: "#FFF", borderRadius: 12, borderWidth: 1, borderColor: "#FF3B30" }}
          >
            <Text style={{ color: "#FF3B30", fontWeight: "800", textAlign: "center" }}>解除連結</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "900" }}>功能選單</Text>

        <Pressable
          onPress={() => router.push("/caregiver/camera")}
          style={{ paddingVertical: 18, backgroundColor: "#007AFF", borderRadius: 16, alignItems: "center", flexDirection: 'row', justifyContent: 'center', gap: 10 }}
        >
          <Text style={{ fontSize: 18, fontWeight: "900", color: "#fff" }}>📷 拍藥單 / 選照片</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/caregiver/list")}
          style={{ paddingVertical: 18, borderWidth: 2, borderColor: "#007AFF", borderRadius: 16, alignItems: "center" }}
        >
          <Text style={{ fontSize: 18, fontWeight: "900", color: "#007AFF" }}>📖 查看藥單紀錄</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => logout().then(() => router.replace("/(auth)/login"))}
        style={{ marginTop: 10, padding: 10 }}
      >
        <Text style={{ color: "#999", textAlign: "center", fontWeight: "700", fontSize: 16 }}>登出系統</Text>
      </Pressable>
    </ScrollView>
  );
}