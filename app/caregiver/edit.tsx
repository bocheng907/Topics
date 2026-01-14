import { useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

type Item = { name: string; dose: string; time: string; note: string };

function safeParseItems(itemsJson?: string): Item[] {
  if (!itemsJson) return [];
  try {
    const data = JSON.parse(itemsJson);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default function CaregiverEditScreen() {
  const { imageUri, itemsJson } = useLocalSearchParams<{ imageUri?: string; itemsJson?: string }>();

  const initial = useMemo(() => safeParseItems(itemsJson), [itemsJson]);
  const [items, setItems] = useState<Item[]>(
    initial.length > 0 ? initial : [{ name: "", dose: "", time: "morning", note: "" }]
  );

  function updateItem(idx: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function addRow() {
    setItems((prev) => [...prev, { name: "", dose: "", time: "morning", note: "" }]);
  }

  function removeRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function onSave() {
    // 簡單驗證：至少 1 筆、藥名不能全空
    const cleaned = items.map((it) => ({
      ...it,
      name: (it.name ?? "").trim(),
      dose: (it.dose ?? "").trim(),
      time: (it.time ?? "").trim(),
      note: (it.note ?? "").trim(),
    }));
    if (cleaned.length === 0 || cleaned.every((it) => !it.name)) {
      Alert.alert("資料不完整", "至少要有一筆藥名。");
      return;
    }

    // 把編輯結果帶回 result（用 replace 回同一頁 + 新 params）
    router.replace({
      pathname: "/caregiver/result",
      params: {
        imageUri: imageUri ?? "",
        itemsJson: JSON.stringify(cleaned),
        edited: "1",
      },
    });
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 26, fontWeight: "800" }}>編輯 / 修正</Text>
      <Text style={{ opacity: 0.7 }}>
        這頁只負責「修改解析結果」。按儲存後會回到 result。
      </Text>

      {items.map((it, idx) => (
        <View
          key={idx}
          style={{ borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 }}
        >
          <Text style={{ fontWeight: "800" }}>第 {idx + 1} 筆</Text>

          <TextInput
            value={it.name}
            onChangeText={(t) => updateItem(idx, { name: t })}
            placeholder="藥名（中文）"
            style={{ borderWidth: 1, borderRadius: 10, padding: 10 }}
          />

          <TextInput
            value={it.dose}
            onChangeText={(t) => updateItem(idx, { dose: t })}
            placeholder="劑量（例如 1 顆 / 1 包）"
            style={{ borderWidth: 1, borderRadius: 10, padding: 10 }}
          />

          <TextInput
            value={it.time}
            onChangeText={(t) => updateItem(idx, { time: t })}
            placeholder='時段（建議：morning/noon/afternoon/night）'
            style={{ borderWidth: 1, borderRadius: 10, padding: 10 }}
          />

          <TextInput
            value={it.note}
            onChangeText={(t) => updateItem(idx, { note: t })}
            placeholder="備註（例如 飯後 / 睡前）"
            style={{ borderWidth: 1, borderRadius: 10, padding: 10 }}
          />

          <Pressable onPress={() => removeRow(idx)} style={{ paddingVertical: 6 }}>
            <Text style={{ color: "#FF3B30", fontWeight: "800" }}>刪除此筆</Text>
          </Pressable>
        </View>
      ))}

      <Pressable onPress={addRow} style={{ paddingVertical: 10 }}>
        <Text style={{ color: "#007AFF", fontSize: 18, fontWeight: "800" }}>＋新增一筆</Text>
      </Pressable>

      <Pressable onPress={onSave} style={{ paddingVertical: 12 }}>
        <Text style={{ color: "#007AFF", fontSize: 20, fontWeight: "900" }}>儲存並返回</Text>
      </Pressable>

      <Pressable onPress={() => router.back()} style={{ paddingVertical: 10 }}>
        <Text style={{ color: "#007AFF", fontSize: 18, fontWeight: "700" }}>取消</Text>
      </Pressable>
    </ScrollView>
  );
}
