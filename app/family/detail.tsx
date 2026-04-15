import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Image, StyleSheet, StatusBar } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc, collection, getDocs, query } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { useAuthContext } from "@/src/auth/AuthProvider";
import { Ionicons } from "@expo/vector-icons";

export default function FamilyDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { ready } = useAuthContext();
  const [p, setP] = useState<any | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const presRef = doc(db, "prescriptions", id);
        const presSnap = await getDoc(presRef);
        
        if (presSnap.exists()) {
          const data = presSnap.data() as any;
          
          // 💡 讀取子集合 items
          const itemsSnap = await getDocs(query(collection(db, "prescriptions", id, "items")));
          
          const mappedItems = itemsSnap.docs.map(d => {
            const it = d.data() as any;
            return {
              name: it.drug_name ?? it.drug_name_zh ?? "",
              dose: it.dosage ?? it.dose ?? "",
              usage: it.usage_zh ?? it.usage ?? "未設定",
              note: it.memo ?? it.note_zh ?? "無",
            };
          });

          setP({ 
            prescriptionId: presSnap.id, 
            ...data, 
            items: mappedItems 
          });
        }
      } catch (error) {
        console.error("讀取詳情失敗:", error);
      }
    })();
  }, [id]);

  if (!ready || !p) return <View style={styles.center}><Text>載入中…</Text></View>;

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
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.mainTitle}>{p.title || "藥單名稱"}</Text>
            {/* ✅ 修正：截圖中 createdAt 是字串，直接顯示即可 */}
            <Text style={styles.subInfo}>紀錄日期：{p.createdAt || "未知"}</Text>
          </View>
          <Pressable 
            onPress={() => router.push({ pathname: "/family/edit", params: { id: p.prescriptionId, itemsJson: JSON.stringify(p.items), title: p.title } })} 
            style={styles.editBtn}
          >
            <Text style={styles.editBtnText}>編輯</Text>
          </Pressable>
        </View>

        {p.sourceImageUrl && <Image source={{ uri: p.sourceImageUrl }} style={styles.img} resizeMode="contain" />}
        
        <Text style={styles.sectionTitle}>內容</Text>
        {p.items?.map((it: any, idx: number) => (
          <View key={idx} style={styles.itemCard}>
            <Text style={styles.itemName}>{it.name}</Text>
            <Text style={styles.itemInfo}>用法劑量：{it.dose}</Text>
            <Text style={styles.itemInfo}>服用時段：{it.usage}</Text>
            <Text style={styles.itemNote}>備註：{it.note}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { backgroundColor: "#FFE043", height: 115, paddingTop: 60, paddingHorizontal: 15, flexDirection: "row", alignItems: "center" },
  backButton: { flexDirection: "row", alignItems: "center" },
  backText: { fontSize: 20, fontWeight: 'bold', color: '#000', marginLeft: 2 },
  scrollContent: { padding: 20, gap: 16 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mainTitle: { fontSize: 26, fontWeight: "bold", color: "#333" },
  subInfo: { fontSize: 14, color: "#999", marginTop: 4 },
  editBtn: { backgroundColor: "#7BA9FF", paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 },
  editBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  img: { width: "100%", height: 250, borderRadius: 15, backgroundColor: "#f0f0f0" },
  sectionTitle: { fontSize: 22, fontWeight: "bold", marginTop: 10, color: "#333" },
  itemCard: { padding: 18, borderRadius: 15, borderWidth: 1, borderColor: "#E0E0E0", backgroundColor: "#fff", gap: 6 },
  itemName: { fontSize: 18, fontWeight: "bold", color: "#007AFF", marginBottom: 4 },
  itemInfo: { fontSize: 15, color: "#333" },
  itemNote: { fontSize: 14, color: "#999", marginTop: 4 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" }
});