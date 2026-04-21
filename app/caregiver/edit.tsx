import React, { useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, Alert, StyleSheet, StatusBar } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuthContext } from "@/src/auth/AuthProvider";
import { Ionicons } from "@expo/vector-icons";
import { doc, collection, getDocs, query, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";

function safeParseItems(itemsJson?: string) {
  if (!itemsJson) return [{ name: "", dosage: "", usage_type: "", usage_time: "", memo: "" }];
  try {
    const data = JSON.parse(itemsJson);
    return data.map((it: any) => {
      const usage = it.usage_zh ?? it.usage ?? "";
      const parts = usage.includes(",") ? usage.split(",") : [usage, ""];
      return {
        name: it.drug_name ?? it.name ?? "",
        dosage: it.dosage ?? it.dose ?? "",
        usage_type: parts[0] || "",
        usage_time: parts.slice(1).join(",") || "",
        memo: it.memo ?? it.note ?? "",
      };
    });
  } catch (e) {
    return [{ name: "", dosage: "", usage_type: "", usage_time: "", memo: "" }];
  }
}

export default function CaregiverEditScreen() {
  const { id, itemsJson } = useLocalSearchParams<{ id?: string; itemsJson?: string }>();
  const { ready } = useAuthContext();
  const initialItems = useMemo(() => safeParseItems(itemsJson), [itemsJson]);
  const [items, setItems] = useState(initialItems);

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      const batch = writeBatch(db);
      const presRef = doc(db, "prescriptions", id);
      batch.update(presRef, { updatedAt: serverTimestamp() });

      const itemsQuery = query(collection(db, "prescriptions", id, "items"));
      const itemsSnap = await getDocs(itemsQuery);
      
      itemsSnap.docs.forEach((docSnap, index) => {
        const itemRef = doc(db, "prescriptions", id, "items", docSnap.id);
        const it = items[index];
        if (it) {
          const combinedUsage = `${it.usage_type}${it.usage_time ? "," + it.usage_time : ""}`;
          batch.update(itemRef, {
            drug_name: it.name,
            dosage: it.dosage,
            usage_zh: combinedUsage,
            memo: it.memo,
            updatedAt: serverTimestamp()
          });
        }
      });

      await batch.commit();
      Alert.alert("更新成功", "雲端資料已同步", [{ text: "確定", onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert("錯誤", "無法連線至雲端資料庫");
    }
  };

  if (!ready) return <View style={styles.center}><Text>載入中…</Text></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#333" /><Text style={styles.backText}>返回</Text>
        </Pressable>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>修正藥單資訊</Text>
        <Pressable onPress={handleSave} style={styles.saveBtn}><Text style={styles.saveBtnText}>儲存</Text></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {items.map((it: any, idx: number) => (
          <View key={idx} style={styles.editCard}>
            <Text style={styles.itemTag}>藥品項目 {idx + 1}</Text>
            <View style={styles.inputBox}><Text style={styles.label}>藥名</Text><TextInput style={styles.input} value={it.name} onChangeText={(t) => updateItem(idx, 'name', t)} /></View>
            <View style={styles.inputBox}><Text style={styles.label}>劑量</Text><TextInput style={styles.input} value={it.dosage} onChangeText={(t) => updateItem(idx, 'dosage', t)} /></View>
            <View style={styles.inputBox}><Text style={styles.label}>用法 (如: 口服)</Text><TextInput style={styles.input} value={it.usage_type} onChangeText={(t) => updateItem(idx, 'usage_type', t)} /></View>
            <View style={styles.inputBox}><Text style={styles.label}>服用時間 (如: 每日兩次)</Text><TextInput style={styles.input} value={it.usage_time} onChangeText={(t) => updateItem(idx, 'usage_time', t)} /></View>
            <View style={styles.inputBox}><Text style={styles.label}>備註</Text><TextInput style={[styles.input, styles.memoInput]} value={it.memo} multiline onChangeText={(t) => updateItem(idx, 'memo', t)} /></View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { backgroundColor: "#FFE043", height: 100, paddingTop: 50, paddingHorizontal: 15, flexDirection: "row", alignItems: "center" },
  backBtn: { flexDirection: "row", alignItems: "center" },
  backText: { fontSize: 20, fontWeight: 'bold', color: '#000', marginLeft: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
  pageTitle: { fontSize: 26, fontWeight: "900", color: "#000" },
  saveBtn: { backgroundColor: "#A7C7FF", paddingHorizontal: 18, paddingVertical: 8, borderRadius: 12 },
  saveBtnText: { color: "#0863f6", fontWeight: "bold", fontSize: 16 },
  scrollContent: { padding: 20, gap: 20 },
  editCard: { padding: 20, borderRadius: 20, borderWidth: 1, borderColor: "#E0E0E0", backgroundColor: "#fff", gap: 15 },
  itemTag: { color: "#007AFF", fontWeight: "bold", fontSize: 16 },
  inputBox: { gap: 8 },
  label: { fontSize: 15, color: "#666", fontWeight: "600" },
  input: { backgroundColor: "#F5F5F5", padding: 12, borderRadius: 10, fontSize: 16 },
  memoInput: { height: 80, textAlignVertical: 'top' },
  center: { flex: 1, justifyContent: "center", alignItems: "center" }
});