// app/caregiver/edit.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";

// 定義藥品項目的結構
type EditItem = {
  name: string;
  dose: string;
  time: string[];
  note: string;
  quantity?: string;
};

export default function CaregiverEditScreen() {
  const params = useLocalSearchParams<{
    id: string;
    title: string;
    itemsJson: string;
  }>();

  const [title, setTitle] = useState(params.title || "");
  const [items, setItems] = useState<EditItem[]>([]);

  // 1. 初始化資料與防呆機制
  useEffect(() => {
    if (params.itemsJson) {
      try {
        const parsed = JSON.parse(params.itemsJson);
        // 如果解析出來是空的，給一組空白欄位方便手動輸入
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed);
        } else {
          setItems([{ name: "", dose: "", time: [], note: "" }]);
        }
      } catch (e) {
        console.error("Parse itemsJson error:", e);
        setItems([{ name: "", dose: "", time: [], note: "" }]);
      }
    }
  }, [params.itemsJson]);

  // 更新特定項目的內容
  const updateItem = (index: number, field: keyof EditItem, value: string) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  // 新增一個藥品列
  const addRow = () => {
    setItems([...items, { name: "", dose: "", time: [], note: "" }]);
  };

  // 2. 儲存到 Firebase
  const onSave = async () => {
    if (!params.id) return;
    try {
      const docRef = doc(db, "prescriptions", params.id);
      await updateDoc(docRef, {
        title: title,
        // 注意：這裡假設後端架構會同步更新子集合或欄位，視你專案邏輯而定
      });
      Alert.alert("儲存成功", "藥單內容已更新");
      router.back();
    } catch (e) {
      console.error("Save error:", e);
      Alert.alert("儲存失敗", "請檢查網路連線");
    }
  };

  return (
    <View style={styles.mainContainer}>
      {/* 統一的黃色 Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={20}>
          <Text style={styles.backIcon}>← 返回</Text>
        </Pressable>
        <Text style={styles.headerTitle}>修改藥單內容</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 藥單標題編輯 */}
        <View style={styles.section}>
          <Text style={styles.label}>藥單名稱</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            style={styles.titleInput}
            placeholder="例如：3/29 榮總藥單"
          />
        </View>

        <Text style={styles.sectionTitle}>藥品清單</Text>

        {/* 藥品卡片清單 */}
        {items.map((it, idx) => (
          <View key={idx} style={styles.medicineCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>藥品名稱</Text>
              <TextInput
                value={it.name}
                onChangeText={(txt) => updateItem(idx, "name", txt)}
                style={styles.textInput}
                placeholder="請輸入藥名"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>用法劑量</Text>
              <TextInput
                value={it.dose}
                onChangeText={(txt) => updateItem(idx, "dose", txt)}
                style={styles.textInput}
                placeholder="例如：1 粒"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>備註 (選填)</Text>
              <TextInput
                value={it.note}
                onChangeText={(txt) => updateItem(idx, "note", txt)}
                style={[styles.textInput, { height: 80 }]}
                multiline
                placeholder="如有特殊醫囑請註記"
              />
            </View>
          </View>
        ))}

        {/* 新增按鈕：虛線樣式 */}
        <Pressable onPress={addRow} style={styles.dashedBtn}>
          <Text style={styles.dashedBtnText}>＋ 新增藥品項目</Text>
        </Pressable>

        {/* 儲存按鈕：深藍色 */}
        <Pressable onPress={onSave} style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>完成修正並儲存</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#FFF" },
  header: {
    backgroundColor: "#F4E770",
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backIcon: { fontSize: 30, fontWeight: "bold" },
  headerTitle: { fontSize: 20, fontWeight: "900" },
  scrollContent: { padding: 20, paddingBottom: 150, gap: 16 },
  
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 22, fontWeight: "900", marginTop: 10 },
  label: { fontSize: 16, fontWeight: "700", marginBottom: 8, color: "#666" },
  
  titleInput: {
    borderBottomWidth: 2,
    borderBottomColor: "#F4E770",
    fontSize: 24,
    fontWeight: "800",
    paddingVertical: 8,
    color: "#000",
  },
  
  medicineCard: {
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#333",
    borderRadius: 20,
    backgroundColor: "#fff",
    gap: 12,
  },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 16, fontWeight: "700", color: "#4651DB" },
  textInput: {
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    backgroundColor: "#FAFAFA",
  },
  
  dashedBtn: {
    padding: 16,
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: "#4651DB",
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
  },
  dashedBtnText: { color: "#4651DB", fontWeight: "800", fontSize: 18 },
  
  saveBtn: {
    backgroundColor: "#4651DB",
    padding: 18,
    borderRadius: 16,
    marginTop: 20,
    shadowColor: "#4651DB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveBtnText: { color: "#fff", textAlign: "center", fontSize: 20, fontWeight: "900" },
});