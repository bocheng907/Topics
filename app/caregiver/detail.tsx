import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Image, Alert, StyleSheet, StatusBar, } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "@/firebase/firebaseConfig";

const TIME_LABELS: Record<string, string> = {
  morning: "早上",
  noon: "中午",
  afternoon: "下午",
  night: "晚上",
};

type PrescriptionItem = {
  drug_name_zh: string;
  dose: string;
  quantity?: string;
  usage?: string;
  time_of_day?: string[];
  note_zh?: string;
};

type PrescriptionDoc = {
  prescriptionId: string;
  title?: string;
  createdAt?: any;
  sourceImageUrl?: string;
};

function toMillis(ts: any): number {
  if (ts?.toMillis) return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (typeof ts === "number") return ts;
  return Date.now();
}

export default function CaregiverDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [p, setP] = useState<PrescriptionDoc | null>(null);
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoaded(true);
      return;
    }

    (async () => {
      try {
        const presRef = doc(db, "prescriptions", id);
        const presSnap = await getDoc(presRef);

        if (!presSnap.exists()) {
          setP(null);
          setItems([]);
          setLoaded(true);
          return;
        }

        const data = presSnap.data() as any;

        setP({
          prescriptionId: presSnap.id,
          title: data.title ?? "",
          createdAt: data.createdAt ?? "",
          sourceImageUrl: data.sourceImageUrl ?? "",
        });

        const itemsQ = query(
          collection(db, "prescriptions", id, "items"),
          orderBy("__name__", "asc")
        );
        const itemsSnap = await getDocs(itemsQ);

        const list = itemsSnap.docs.map((d) => {
          const it = d.data() as any;
          return {
            drug_name_zh: it.drug_name ?? it.drug_name_zh ?? "",
            dose: it.dosage ?? it.dose ?? "",
            quantity: it.quantity ?? "",
            usage: it.usage_zh ?? it.usage ?? "",
            time_of_day: it.time_of_day ?? [],
            note_zh: it.memo ?? it.note_zh ?? "",
          } as PrescriptionItem;
        });

        setItems(list);
        setLoaded(true);
      } catch (e) {
        console.log("detail read error:", e);
        setLoaded(true);
        Alert.alert("讀取失敗", "無法讀取藥單資料");
      }
    })();
  }, [id]);

  if (!loaded) {
    return (
      <View style={{ flex: 1, padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: "800" }}>讀取中...</Text>
      </View>
    );
  }

  if (!id || !p) {
    return (
      <View style={{ flex: 1, padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: "800" }}>找不到資料</Text>
        <Pressable onPress={() => router.replace("/caregiver")}>
          <Text style={{ color: "#007AFF" }}>回列表</Text>
        </Pressable>
      </View>
    );
  }

  const goEdit = () => {
    router.push({
      pathname: "/caregiver/edit",
      params: {
        id: p.prescriptionId,
        title: p.title || "",
        imageUri: p.sourceImageUrl || "",
        itemsJson: JSON.stringify(
          items.map((it) => ({
            name: it.drug_name_zh,
            dose: it.dose,
            time: it.usage ? [it.usage] : (it.time_of_day ?? []),
            note: it.note_zh || "",
            quantity: it.quantity || "",
          }))
        ),
      },
    });
  };

  const confirmDelete = () => {
    Alert.alert("確認刪除", "這筆藥單紀錄將會永久移除。", [
      { text: "取消", style: "cancel" },
      {
        text: "確定刪除",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "prescriptions", p.prescriptionId));
            router.replace("/caregiver");
          } catch (e) {
            console.log("delete error:", e);
            Alert.alert("刪除失敗", "無法刪除這筆藥單");
          }
        },
      },
    ]);
  };

  return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#333" />
            <Text style={styles.backText}>返回</Text>
          </Pressable>
          <Text style={styles.headerTitle}>藥單詳情</Text>
          <Pressable onPress={goEdit} style={styles.editBtn}>
            <Text style={styles.editBtnText}>編輯</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.mainTitle}>{p.title || "藥單內容"}</Text>
          <Text style={styles.subInfo}>錄入日期：{new Date(p.createdAt).toLocaleDateString()}</Text>

          {p.sourceImageUrl && (
            <Image source={{ uri: p.sourceImageUrl }} style={styles.img} resizeMode="contain" />
          )}

          <Text style={styles.sectionTitle}>藥品明細</Text>
          {items.map((it, idx) => (
            <View key={idx} style={styles.itemCard}>
              <Text style={styles.itemName}>{it.drug_name_zh}</Text>
              <Text style={styles.itemInfo}>用法劑量：{it.dose}</Text>
              <Text style={styles.itemInfo}>服用時段：{it.time_of_day?.map(t => TIME_LABELS[t] || t).join(", ") || "未提供"}</Text>
              <Text style={styles.itemNote}>備註：{it.note_zh || "無"}</Text>
            </View>
          ))}

          <Pressable onPress={confirmDelete} style={styles.delBtn}>
            <Text style={styles.delBtnText}>刪除此筆紀錄</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    header: { backgroundColor: "#FFE043", height: 110, paddingTop: 50, paddingHorizontal: 15, flexDirection: "row", alignItems: "center" },
    backButton: { flexDirection: "row", alignItems: "center" },
    backText: { fontSize: 18, fontWeight: "600", color: "#333", marginLeft: -5 },
    headerTitle: { flex: 1, textAlign: "center", fontSize: 20, fontWeight: "bold", marginLeft: -20 },
    editBtn: { backgroundColor: "#7BA9FF", paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
    editBtnText: { color: "#fff", fontWeight: "bold" },
    scrollContent: { padding: 20 },
    mainTitle: { fontSize: 26, fontWeight: "900", color: "#333" },
    subInfo: { color: "#999", marginBottom: 15 },
    img: { width: "100%", height: 300, borderRadius: 12, backgroundColor: "#eee", marginBottom: 20 },
    sectionTitle: { fontSize: 20, fontWeight: "800", marginBottom: 10 },
    itemCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#eee", backgroundColor: "#fff", marginBottom: 10 },
    itemName: { fontSize: 18, fontWeight: "800", color: "#007AFF", marginBottom: 4 },
    itemInfo: { fontSize: 16, color: "#333" },
    itemNote: { fontSize: 14, color: "#999", marginTop: 4 },
    delBtn: { marginTop: 30, padding: 15 },
    delBtnText: { color: "#FF3B30", textAlign: "center", fontWeight: "bold" }
  });