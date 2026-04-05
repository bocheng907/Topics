import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from "react-native";
import { router } from "expo-router";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { useAuth } from "@/src/auth/useAuth";

function toMillis(ts: any): number {
  if (ts?.toMillis) return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (typeof ts === "number") return ts;
  return Date.now();
}

export default function CaregiverListScreen() {
  const { activePatientId, activePatient } = useActiveCareTarget();
  const { user } = useAuth();

  const [list, setList] = useState<any[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!activePatientId || !user?.uid) return;

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
            createdAt: toMillis(data.createdAt),
            status: data.status ?? "",
            sourceImageUrl: data.sourceImageUrl ?? "",
          };
        });
        setList(rows);
        setReady(true);
      },
      (err) => {
        console.log("prescriptions snapshot error:", err);
        setReady(true);
      }
    );

    return unsub;
  }, [activePatientId, user?.uid]);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>讀取雲端資料中…</Text>
      </View>
    );
  }

  if (!activePatientId) {
    return (
      <View style={{ flex: 1, padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "800" }}>請先選擇長輩</Text>
        <Pressable onPress={() => router.replace("/caregiver")}>
          <Text style={{ color: "#007AFF" }}>前往選擇頁面</Text>
        </Pressable>
      </View>
    );
  }

  const confirmDelete = (id: string) => {
    Alert.alert("確認刪除", "刪除後無法還原，確定嗎？", [
      { text: "取消", style: "cancel" },
      {
        text: "確定刪除",
        style: "destructive",
        onPress: () => Alert.alert("提示", "刪除功能待接 firestore 刪除"),
      },
    ]);
  };

  return (
  <View style={{ flex: 1, backgroundColor: "#FFF" }}>
    {/* 修改後的 Header：只保留黃色背景與返回鍵 */}
    <View style={styles.header}>
       <Pressable 
          onPress={() => router.replace("/caregiver")}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
       >
       </Pressable>
       {/* 💡 這裡原本的 <Text>藥單紀錄簿</Text> 已被刪除 */}
       <View style={{ width: 40 }} /> 
    </View>

    <ScrollView contentContainerStyle={styles.scrollContainer}>
      {/* 確保這裡的條件判斷不會噴出純文字 */}
      {list.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>目前尚無藥單紀錄</Text>
          <Text style={styles.emptySubtitle}>
            {"您可以點擊下方的相機按鈕\n為長輩掃描第一份藥單"}
          </Text>
        </View>
      ) : (
        list.map((p: any) => (
          <View key={p.prescriptionId} style={styles.card}>
            {/* 確保變數 p.title 也是被 <Text> 包住的 */}
            <Text style={styles.cardTitle}>{p.title || "未命名藥單"}</Text>
            <Text style={styles.cardDate}>
              日期：{new Date(p.createdAt).toLocaleDateString()}
            </Text>
            
            <View style={styles.divider} />
            
            <View style={{ flexDirection: "row", gap: 20 }}>
              <Pressable onPress={() => router.push({ pathname: "/caregiver/detail", params: { id: p.prescriptionId } })}>
                <Text style={styles.linkText}>查看詳情</Text>
              </Pressable>
              <Pressable onPress={() => confirmDelete(p.prescriptionId)}>
                <Text style={[styles.linkText, { color: "#FF3B30" }]}>刪除</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  </View>
);
}

const styles = StyleSheet.create({
  header: { 
    backgroundColor: "#F4E770", 
    paddingTop: 60, 
    paddingBottom: 20, 
    paddingHorizontal: 20, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  scrollContainer: { padding: 20, paddingBottom: 150, gap: 16 },
  // 提示詞樣式
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyEmoji: { fontSize: 80, marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: '#333' },
  emptySubtitle: { fontSize: 16, color: '#999', textAlign: 'center', marginTop: 10, lineHeight: 24 },
  // 卡片樣式
  card: { padding: 16, borderWidth: 1.5, borderRadius: 16, borderColor: "#333", backgroundColor: "#fff" },
  cardTitle: { fontSize: 22, fontWeight: "800", color: "#000", marginBottom: 4 },
  cardDate: { fontSize: 16, color: "#666", marginBottom: 12 },
  divider: { height: 1, backgroundColor: "#EEE", marginBottom: 12 },
  linkText: { color: "#4651DB", fontSize: 18, fontWeight: "700" }
});