import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, StatusBar, Alert } from "react-native";
import { router } from "expo-router";
import { collection, onSnapshot, orderBy, query, where, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { useAuthContext } from "@/src/auth/AuthProvider";
import { Ionicons } from "@expo/vector-icons";

export default function FamilyListScreen() {
  const { activePatientId } = useActiveCareTarget();
  const { ready } = useAuthContext();
  const [list, setList] = useState<any[]>([]);

  useEffect(() => {
    if (!activePatientId) return;

    const q = query(
      collection(db, "prescriptions"),
      where("patientId", "==", activePatientId)
    );

    const unsub = onSnapshot(q, (snap) => {
      setList(snap.docs.map(d => {
        const data = d.data() as any;
        return {
          prescriptionId: d.id,
          title: data.title || "未命名藥單",
          createdAt: data.createdAt,
        };
      }));
    });
    return unsub;
  }, [activePatientId]);

  const handleDelete = (id: string) => {
    Alert.alert("刪除藥單", "確定要刪除這份藥單紀錄嗎？", [
      { text: "取消", style: "cancel" },
      { text: "確定刪除", style: "destructive", onPress: async () => {
        try {
          await deleteDoc(doc(db, "prescriptions", id));
        } catch (e) {
          Alert.alert("錯誤", "刪除失敗，請檢查權限");
        }
      }}
    ]);
  };

  if (!ready) return <View style={styles.center}><Text>讀取中…</Text></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#333" />
          <Text style={styles.backText}>返回</Text>
        </Pressable>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {list.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={60} color="#CCC" />
            <Text style={styles.emptyText}>目前尚無藥單紀錄</Text>
          </View>
        ) : (
          list.map((p) => (
            <View key={p.prescriptionId} style={styles.card}>
              <View style={{ gap: 4 }}>
                <Text style={styles.cardTitle}>{p.title || "藥單名稱"}</Text>
                <Text style={styles.cardDate}>
                  日期：{
                    typeof p.createdAt === 'string' 
                      ? p.createdAt 
                      : (p.createdAt?.seconds 
                          ? new Date(p.createdAt.seconds * 1000).toLocaleDateString() 
                          : "未知")
                  }
                </Text>
              </View>
              {/* 💡 底部按鈕排版 */}
              <View style={styles.cardFooter}>
                <Pressable onPress={() => router.push({ pathname: "/family/detail", params: { id: p.prescriptionId } })}>
                  <Text style={styles.detailText}>查看詳情</Text>
                </Pressable>
                <Pressable onPress={() => handleDelete(p.prescriptionId)}>
                  <Text style={styles.deleteText}>刪除</Text>
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
  container: { flex: 1, backgroundColor: "#fff" },
  header: { 
    backgroundColor: "#FFE043", 
    height: 100, 
    paddingTop: 50, 
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: { flexDirection: "row", alignItems: "center" },
  backText: { fontSize: 20, fontWeight: 'bold', color: '#000', marginLeft: 2 },
  scrollContent: { padding: 20, gap: 15 },
  emptyContainer: { marginTop: 100, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { fontSize: 18, fontWeight: "bold", color: "#666" },
  card: { 
    padding: 18, 
    borderRadius: 15, 
    borderWidth: 1, 
    borderColor: "#E0E0E0", 
    backgroundColor: "#fff", 
    gap: 12 
  },
  cardTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  cardDate: { fontSize: 14, color: "#999" },
  cardFooter: { 
    flexDirection: "row", 
    borderTopWidth: 1, 
    borderTopColor: "#EEE", 
    paddingTop: 10, 
    gap: 15 
  },
  detailText: { color: "#007AFF", fontWeight: "bold", fontSize: 16 },
  deleteText: { color: "#FF3B30", fontWeight: "bold", fontSize: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" }
});