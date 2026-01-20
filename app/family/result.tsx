import { useEffect, useMemo, useState } from "react";
import { View, Text, Image, ActivityIndicator, ScrollView, Pressable, TextInput, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "@/src/store/useStore";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { usePrescriptionsRepo } from "@/src/store/prescriptions";

// ✅ 1. 確保 time 是字串陣列
type Item = { name: string; dose: string; time: string[]; note: string };

const TIME_LABELS: Record<string, string> = {
  morning: "早上",
  noon: "中午",
  afternoon: "下午",
  night: "晚上",
};

function safeParseItems(itemsJson?: string): Item[] | null {
  if (!itemsJson) return null;
  try {
    const data = JSON.parse(itemsJson);
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

export default function ResultScreen() { // ✅ 2. 修正組件名稱
  const { imageUri, itemsJson, id, title: incomingTitle } = useLocalSearchParams<{ 
    imageUri?: string; 
    itemsJson?: string;
    id?: string;
    title?: string;
  }>();
  
  const { activeCareTargetId } = useActiveCareTarget();
  const { deletePrescription } = useStore();
  const repo = usePrescriptionsRepo();

  const editedItems = useMemo(() => safeParseItems(itemsJson), [itemsJson]);
  const [status, setStatus] = useState<"loading" | "done">("loading");
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState(incomingTitle || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // ✅ 3. 核心修正：如果有傳回來的資料，直接設為 done，不再啟動 setTimeout
    if (editedItems) {
      setItems(editedItems);
      setStatus("done");
    } else {
      // 只有第一次進來（沒 itemsJson）才跑模擬解析
      setStatus("loading");
      const t = setTimeout(() => {
        setItems([
          { name: "普拿疼", dose: "1 顆", time: ["morning", "night"], note: "飯後服用" },
          { name: "胃藥", dose: "1 包", time: ["night"], note: "睡前服用" },
        ]);
        setStatus("done");
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [editedItems]);

  const goEdit = () => {
    router.replace({
      pathname: "/family/edit",
      params: {
        id: id ?? "",
        imageUri: imageUri ?? "",
        itemsJson: JSON.stringify(items),
        title: title,
      },
    });
  };

  const onConfirmSave = async () => {
    if (!activeCareTargetId) {
      Alert.alert("錯誤", "請先選擇長輩");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        careTargetId: activeCareTargetId,
        title: title.trim(), // ✅ 傳入標題
        sourceImageUrl: imageUri,
        status: "parsed" as const,
        items: items.map(it => ({
          drug_name_zh: it.name,
          dose: it.dose,
          time_of_day: it.time as any,
          note_zh: it.note,
        })),
      };

      if (id) {
        // ✅ 模式 A：直接更新現有資料，ID 不會變
        await repo.update(id, payload);
      } else {
        // ✅ 模式 B：新增紀錄
        await repo.create(payload);
      }
    
      Alert.alert("成功", id ? "紀錄已更新" : "藥單已儲存", [
        { text: "確定", onPress: () => router.replace("/family/list") }
      ]);
    } catch (e) {
      Alert.alert("儲存失敗");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop:90, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "900", color: "#333" }}>
        {status === "loading" ? "解析中..." : "確認藥單資訊"}
      </Text>

      {imageUri && (
        <Image source={{ uri: imageUri }} style={{ width: "100%", height: 200, borderRadius: 12, backgroundColor: '#eee' }} resizeMode="contain" />
      )}

      {status === "loading" ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={{ marginTop: 10, opacity: 0.6 }}>AI 正在努力解析中...</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontWeight: "800", fontSize: 16 }}>紀錄標題</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="例如：1/18 診所感冒藥"
              style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, backgroundColor: "#fff" }}
            />
          </View>

          <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 8 }}>藥品明細</Text>

          {items.map((it, idx) => (
            <View key={idx} style={{ padding: 16, borderWidth: 1, borderColor: '#eee', borderRadius: 12, backgroundColor: '#fff', gap: 6 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#007AFF" }}>{it.name}</Text>
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 15, color: "#444" }}>用法劑量：{it.dose}</Text>
                <Text style={{ fontSize: 15, color: "#444" }}>
                  服用時段：{it.time.map(t => TIME_LABELS[t] || t).join(", ")}
                </Text>
                <Text style={{ 
                  fontSize: 15, 
                  color: it.note && it.note.trim() !== "" ? "#666" : "#CCC", 
                  marginTop: 2 
                }}>
                  備註：{it.note && it.note.trim() !== "" ? it.note : "無"}
                </Text>
              </View>
            </View>
          ))}

          <View style={{ marginTop: 20, gap: 12 }}>
            <Pressable onPress={goEdit} style={{ padding: 16, borderWidth: 1, borderColor: "#007AFF", borderRadius: 12 }}>
              <Text style={{ color: "#007AFF", textAlign: "center", fontWeight: "700" }}>回編輯頁修正</Text>
            </Pressable>
            <Pressable 
              onPress={onConfirmSave} 
              disabled={submitting}
              style={{ padding: 18, backgroundColor: submitting ? "#ccc" : "#007AFF", borderRadius: 12 }}
            >
              <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800", fontSize: 18 }}>
                {id ? "儲存更新" : "確認並存入病歷"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}