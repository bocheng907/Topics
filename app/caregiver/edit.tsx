import React, { useMemo, useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  ScrollView, 
  Pressable, 
  Alert, 
  StyleSheet, 
  StatusBar 
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuthContext } from "@/src/auth/AuthProvider";
import { Ionicons } from "@expo/vector-icons";

// 💡 修正 1：解析傳入的 JSON，並明確兼容最新的 Firebase 欄位名稱
function safeParseItems(itemsJson?: string) {
  if (!itemsJson) return [{ name: "", dose: "", usage: "", note: "" }];
  try {
    const data = JSON.parse(itemsJson);
    return data.map((it: any) => ({
      // ✅ 對齊最新欄位：優先讀取 drug_name / dosage / usage_zh / memo
      name: it.drug_name ?? it.name ?? it.drug_name_zh ?? "",
      dose: it.dosage ?? it.dose ?? "",
      usage: it.usage_zh ?? it.usage ?? "",
      note: it.memo ?? it.note ?? it.note_zh ?? "",
    }));
  } catch (e) {
    return [{ name: "", dose: "", usage: "", note: "" }];
  }
}

export default function EditScreen() {
  const { id, itemsJson } = useLocalSearchParams<{ id?: string; itemsJson?: string }>();
  const { ready } = useAuthContext();
  
  // 💡 修正 2：初始化狀態
  const [items, setItems] = useState(() => safeParseItems(itemsJson));

  if (!ready) return <View style={styles.center}><Text>載入中…</Text></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header 部分 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </Pressable>
        <Text style={styles.headerTitle}>修正藥單資訊</Text>
        <Pressable style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>儲存</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        {/* 💡 修正 3：明確標註 (it: any, idx: number) 解決紅字警告 */}
        {items.map((it: any, idx: number) => (
          <View key={idx} style={styles.editCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.itemTag}>項目 {idx + 1}</Text>
              <Pressable>
                <Text style={styles.delBtnText}>刪除</Text>
              </Pressable>
            </View>
            
            {/* 藥名輸入框 */}
            <View style={styles.inputBox}>
              <Text style={styles.label}>藥名</Text>
              <TextInput 
                style={styles.input} 
                value={it.name} 
                onChangeText={(text) => {
                  const newItems = [...items];
                  newItems[idx].name = text;
                  setItems(newItems);
                }}
              />
            </View>

            {/* 劑量輸入框 */}
            <View style={styles.inputBox}>
              <Text style={styles.label}>用法劑量</Text>
              <TextInput 
                style={styles.input} 
                value={it.dose} 
                onChangeText={(text) => {
                  const newItems = [...items];
                  newItems[idx].dose = text;
                  setItems(newItems);
                }}
              />
            </View>

            {/* 服用時段輸入框 */}
            <View style={styles.inputBox}>
              <Text style={styles.label}>服用時段</Text>
              <TextInput 
                style={styles.input} 
                value={it.usage} 
                onChangeText={(text) => {
                  const newItems = [...items];
                  newItems[idx].usage = text;
                  setItems(newItems);
                }}
              />
            </View>

            {/* 備註輸入框 */}
            <TextInput 
              style={styles.memo} 
              placeholder="備註" 
              value={it.note} 
              multiline 
              onChangeText={(text) => {
                const newItems = [...items];
                newItems[idx].note = text;
                setItems(newItems);
              }}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { 
    backgroundColor: "#FFE043", 
    height: 110, 
    paddingTop: 50, 
    paddingHorizontal: 15, 
    flexDirection: "row", 
    alignItems: "center" 
  },
  backBtn: { marginRight: 10 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: "bold", color: "#333" },
  saveBtn: { 
    backgroundColor: "#7BA9FF", 
    paddingHorizontal: 15, 
    paddingVertical: 8, 
    borderRadius: 10 
  },
  saveBtnText: { color: "#fff", fontWeight: "bold" },
  editCard: { 
    padding: 20, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: "#E0E0E0", 
    backgroundColor: "#fff", 
    gap: 15 
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  itemTag: { color: "#007AFF", fontWeight: "bold", fontSize: 16 },
  delBtnText: { color: "#FF3B30", fontWeight: "bold" },
  inputBox: { gap: 5 },
  label: { fontSize: 16, fontWeight: "bold", color: "#333" },
  input: { 
    backgroundColor: "#F5F5F5", 
    borderRadius: 10, 
    padding: 12, 
    fontSize: 16 
  },
  memo: { 
    backgroundColor: "#F5F5F5", 
    borderRadius: 10, 
    padding: 12, 
    height: 80, 
    textAlignVertical: "top" 
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" }
});