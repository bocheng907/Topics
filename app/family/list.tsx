import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";

function toMillis(ts: any): number {
  if (ts?.toMillis) return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (typeof ts === "number") return ts;
  return 0;
}

function formatDate(value: any) {
  const ms = toMillis(value);
  if (!ms) return "未知日期";
  return new Date(ms).toLocaleDateString("zh-TW");
}

export default function FamilyListScreen() {
  const { activePatientId, activePatient } = useActiveCareTarget();
  const [list, setList] = useState<any[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setList([]);
    setReady(false);

    if (!activePatientId) {
      setReady(true);
      return;
    }

    const q = query(
      collection(db, "prescriptions"),
      where("patientId", "==", activePatientId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            prescriptionId: d.id,
            title: data.title ?? "未命名藥單",
            createdAt: data.createdAt ?? null,
            status: data.status ?? "",
            sourceImageUrl: data.sourceImageUrl ?? "",
          };
        });

        setList(rows);
        setReady(true);
      },
      (err) => {
        console.log("prescriptions snapshot error:", err);
        setList([]);
        setReady(true);
      }
    );

    return () => unsub();
  }, [activePatientId]);

  const confirmDelete = (id: string) => {
    Alert.alert("確認刪除", "刪除後無法還原，確定嗎？", [
      { text: "取消", style: "cancel" },
      {
        text: "確定刪除",
        style: "destructive",
        onPress: () => Alert.alert("提示", "刪除功能尚未實作"),
      },
    ]);
  };

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>讀取雲端資料中…</Text>
      </View>
    );
  }

  if (!activePatientId) {
    return (
      <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "800" }}>請先選擇長輩</Text>
        <Pressable onPress={() => router.replace("/family")}>
          <Text style={{ color: "#007AFF", fontSize: 16, fontWeight: "700" }}>
            前往選擇頁面
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
  <View style={{ flex: 1, backgroundColor: "#FFF" }}>
    {/* 設計圖風格 Header */}
    <View style={{ backgroundColor: "#FDE982", paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View style={{ width: 40 }} /> {/* 保持平衡 */}
      <Text style={{ fontSize: 24, fontWeight: '900', color: '#000' }}>藥單紀錄簿</Text>
      <Pressable onPress={() => Alert.alert("選單", "開啟側邊欄")}>
        <Text style={{ fontSize: 30 }}>≡</Text>
      </Pressable>
    </View>

    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      {list.map((p) => (
        <View key={p.prescriptionId} style={{
          padding: 16,
          borderWidth: 1.5,
          borderRadius: 12,
          borderColor: "#333", // 深色邊框
          backgroundColor: "#fff",
        }}>
          <Text style={{ fontSize: 22, fontWeight: "900", color: "#000" }}>{p.title}</Text>
          <Text style={{ fontSize: 16, color: "#666", marginBottom: 12 }}>日期：{formatDate(p.createdAt)}</Text>
          
          <View style={{ height: 1, backgroundColor: "#eee", marginBottom: 12 }} />
          
          <View style={{ flexDirection: "row", alignItems: 'center', gap: 15 }}>
            <Pressable onPress={() => router.push({ pathname: "/family/detail", params: { id: p.prescriptionId } })}>
              <Text style={{ color: "#4A90E2", fontSize: 18, fontWeight: "700", textDecorationLine: 'underline' }}>查看詳情</Text>
            </Pressable>
            <Pressable onPress={() => confirmDelete(p.prescriptionId)}>
              <Text style={{ color: "#FF3B30", fontSize: 18, fontWeight: "700" }}>刪除</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  </View>
);
}