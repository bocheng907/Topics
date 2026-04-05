// app/family/edit.tsx
import { useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, Alert, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

type Item = { name: string; dose: string; time: string[]; note: string };

const TIME_LABELS: Record<string, string> = {
  morning: "早上",
  noon: "中午",
  afternoon: "下午",
  night: "晚上",
};

function safeParseItems(itemsJson?: string): Item[] {
  if (!itemsJson) return [];
  try {
    const data = JSON.parse(itemsJson);
    if (!Array.isArray(data)) return [];
    return data.map((it: any) => ({
      name: it.name || it.drug_name_zh || "",
      dose: it.dose || "",
      time: Array.isArray(it.time) ? it.time : (Array.isArray(it.time_of_day) ? it.time_of_day : ["morning"]),
      note: it.note || it.note_zh || "",
    }));
  } catch { return []; }
}

export default function FamilyEditScreen() {
  const { imageUri, itemsJson, id, title: initialTitle } = useLocalSearchParams<{
    imageUri?: string; itemsJson?: string; id?: string; title?: string;
  }>();

  const initial = useMemo(() => safeParseItems(itemsJson), [itemsJson]);
  const [items, setItems] = useState<Item[]>(
    initial.length > 0 ? initial : [{ name: "", dose: "", time: ["morning"], note: "" }]
  );

  function updateItem(idx: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function addRow() {
    setItems((prev) => [...prev, { name: "", dose: "", time: ["morning"], note: "" }]);
  }

  function removeRow(idx: number) {
    if (items.length <= 1) {
      Alert.alert("提醒", "至少需保留一個項目");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function onSave() {
    if (items.some((it) => !it.name.trim())) {
      Alert.alert("請檢查", "藥名不能為空");
      return;
    }
    router.replace({
      pathname: "/family/result",
      params: { id: id ?? "", imageUri: imageUri ?? "", itemsJson: JSON.stringify(items), title: initialTitle ?? "" },
    });
  }

  return (
    <View style={styles.mainContainer}>
      {/* 固定在頂部的 Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={20}>
          <Text style={styles.backIcon}>＜</Text>
        </Pressable>

        <Text style={styles.headerTitle}>修正藥單資訊</Text>

        <Pressable 
          onPress={onSave} 
          style={({ pressed }) => [styles.saveBtnTop, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.saveBtnText}>儲存</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {items.map((it, idx) => (
          <View key={idx} style={styles.medicineCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.itemTitle}>項目 {idx + 1}</Text>
              <Pressable onPress={() => removeRow(idx)}>
                <Text style={styles.deleteText}>刪除</Text>
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>藥名</Text>
              <TextInput
                value={it.name}
                onChangeText={(t) => updateItem(idx, { name: t })}
                style={styles.textInput}
                placeholder="請輸入藥品名稱"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>服用時段 (可多選)</Text>
              <View style={styles.timeTagWrapper}>
                {Object.entries(TIME_LABELS).map(([value, label]) => {
                  const isSelected = it.time.includes(value);
                  return (
                    <Pressable
                      key={value}
                      onPress={() => {
                        const nextTime = isSelected ? it.time.filter((t) => t !== value) : [...it.time, value];
                        updateItem(idx, { time: nextTime });
                      }}
                      style={[styles.timeTag, isSelected && styles.timeTagSelected]}
                    >
                      <Text style={[styles.timeTagText, isSelected && styles.timeTagTextSelected]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>劑量</Text>
              <TextInput
                value={it.dose}
                onChangeText={(t) => updateItem(idx, { dose: t })}
                style={styles.textInput}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>備註</Text>
              <TextInput
                value={it.note}
                onChangeText={(t) => updateItem(idx, { note: t })}
                placeholder="例如：飯後服用"
                style={styles.textInput}
              />
            </View>
          </View>
        ))}

        <Pressable onPress={addRow} style={styles.addBtn}>
          <Text style={styles.addBtnText}>＋ 新增藥品項目</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#FFF" },
  header: {
    backgroundColor: "#FDE982",
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backIcon: { fontSize: 24, fontWeight: 'bold' },
  headerTitle: { fontSize: 20, fontWeight: '900' },
  saveBtnTop: { backgroundColor: "#4A90E2", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  saveBtnText: { color: "#FFF", fontWeight: "900", fontSize: 16 },
  
  scrollContainer: { padding: 20, gap: 16 },
  
  medicineCard: {
    padding: 16,
    borderWidth: 1.5, // 💡 依據設計稿加粗
    borderColor: "#333", // 💡 依據設計稿改深色
    borderRadius: 20,
    backgroundColor: "#fefefe",
    gap: 12,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  itemTitle: { fontWeight: "800", color: "#4A90E2", fontSize: 16 },
  deleteText: { color: "#FF3B30", fontWeight: "600" },
  
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 14, fontWeight: "600", color: "#666" },
  textInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    fontSize: 16
  },
  
  timeTagWrapper: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  timeTag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#ccc", backgroundColor: "#fff" },
  timeTagSelected: { borderColor: "#4A90E2", backgroundColor: "#4A90E2" },
  timeTagText: { color: "#333", fontWeight: "600", fontSize: 13 },
  timeTagTextSelected: { color: "#fff" },
  
  addBtn: { padding: 16, borderStyle: "dashed", borderWidth: 2, borderColor: "#4A90E2", borderRadius: 12 },
  addBtnText: { color: "#4A90E2", textAlign: "center", fontWeight: "700", fontSize: 16 },
});