import React, { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, Image, Alert, StyleSheet, StatusBar } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { collection, doc, getDoc, getDocs, query } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "@/firebase/firebaseConfig";

export default function CaregiverDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [p, setP] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) {
      setLoaded(true);
      return;
    }

    try {
      const presRef = doc(db, "prescriptions", id);
      const presSnap = await getDoc(presRef);
      if (!presSnap.exists()) {
        setLoaded(true);
        return;
      }

      const data = presSnap.data() as any;
      setP({ prescriptionId: presSnap.id, ...data });

      const itemsSnap = await getDocs(query(collection(db, "prescriptions", id, "items")));
      const list = itemsSnap.docs.map((d) => {
        const it = d.data() as any;
        return {
          itemId: d.id,
          drug_name: it.drug_name_zh ?? it.drug_name ?? "",
          dosage: it.dose ?? it.dosage ?? "",
          usage_zh: it.usage_zh ?? it.usage ?? it.time_of_day ?? it.time ?? "",
          memo: it.note_zh ?? it.memo ?? it.note ?? "",
        };
      });
      setItems(list);
      setLoaded(true);
    } catch (e) {
      setLoaded(true);
      Alert.alert("讀取失敗", "無法讀取藥單資料");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  if (!loaded) return <View style={styles.center}><Text>讀取中...</Text></View>;
  if (!id || !p) return <View style={styles.center}><Text>找不到資料</Text></View>;

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
          <View style={{ flex: 1 }}>
            <Text style={styles.mainTitle}>{p.title || "藥單詳情"}</Text>
            <Text style={styles.subInfo}>
              錄入日期：{
                typeof p.createdAt === "string"
                  ? p.createdAt
                  : (p.createdAt?.seconds
                      ? new Date(p.createdAt.seconds * 1000).toLocaleDateString()
                      : "未知")
              }
            </Text>
          </View>
          <Pressable
            onPress={() => router.push({
              pathname: "/caregiver/edit",
              params: { id: p.prescriptionId, itemsJson: JSON.stringify(items) },
            })}
            style={styles.editBtn}
          >
            <Text style={styles.editBtnText}>編輯</Text>
          </Pressable>
        </View>

        {p.sourceImageUrl && (
          <Image source={{ uri: p.sourceImageUrl }} style={styles.img} resizeMode="contain" />
        )}

        <Text style={styles.sectionTitle}>藥品明細</Text>
        {items.map((it, idx) => {
          const usageParts = it.usage_zh?.split(",") || [it.usage_zh, ""];
          const method = usageParts[0] || "未設定";
          const timeDetail = usageParts.slice(1).join(",") || "依醫囑服用";

          return (
            <View key={it.itemId ?? idx} style={styles.itemCard}>
              <Text style={styles.itemName}>{it.drug_name}</Text>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>藥物劑量：</Text><Text style={styles.infoValue}>{it.dosage}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>使用方式：</Text><Text style={styles.infoValue}>{method}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>服用時段：</Text><Text style={styles.infoValue}>{timeDetail}</Text></View>
              {it.memo ? <Text style={styles.itemNote}>備註：{it.memo}</Text> : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { backgroundColor: "#FFE043", height: 100, paddingTop: 50, paddingHorizontal: 15, justifyContent: "center" },
  backButton: { flexDirection: "row", alignItems: "center" },
  backText: { fontSize: 20, fontWeight: "bold", color: "#333", marginLeft: 2 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 15 },
  mainTitle: { fontSize: 28, fontWeight: "900", color: "#333" },
  subInfo: { color: "#999", marginBottom: 10 },
  editBtn: { backgroundColor: "#A7C7FF", paddingHorizontal: 18, paddingVertical: 8, borderRadius: 12 },
  editBtnText: { color: "#0863f6", fontWeight: "bold", fontSize: 16 },
  scrollContent: { padding: 20 },
  img: { width: "100%", height: 300, borderRadius: 12, backgroundColor: "#eee", marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: "800", marginBottom: 10 },
  itemCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#eee", backgroundColor: "#fff", marginBottom: 10 },
  itemName: { fontSize: 18, fontWeight: "800", color: "#007AFF", marginBottom: 8 },
  infoRow: { flexDirection: "row", marginBottom: 4 },
  infoLabel: { fontSize: 15, color: "#666", width: 85 },
  infoValue: { fontSize: 15, color: "#333", fontWeight: "600", flex: 1 },
  itemNote: { fontSize: 14, color: "#999", marginTop: 8, fontStyle: "italic" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
