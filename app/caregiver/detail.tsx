import { View, Text, Pressable, ScrollView, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "@/src/store/useStore";

/**
 * 家屬端：藥單詳情
 * 用 URL params 的 id → 去本地 store 找資料
 * 未來換 Firebase：一樣拿 id 去抓，不用改 UI
 */
export default function FamilyDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getPrescriptionById } = useStore();

  const p = id ? getPrescriptionById(id) : undefined;

  if (!p) {
    return (
      <View style={{ flex: 1, padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: "800" }}>找不到資料</Text>
        <Text style={{ opacity: 0.7 }}>收到的 id：{id ?? "(沒有帶 id)"}</Text>

        <Pressable onPress={() => router.back()} style={{ paddingVertical: 10 }}>
          <Text style={{ color: "#007AFF", fontSize: 18, fontWeight: "700" }}>
            回列表
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 26, fontWeight: "800" }}>藥單詳細</Text>
      <Text style={{ opacity: 0.7 }}>ID：{p.prescriptionId}</Text>
      <Text style={{ opacity: 0.7 }}>狀態：{p.status}</Text>

      {/* ✅ 顯示原始照片（本地 store 存的是 sourceImageUrl） */}
      {p.sourceImageUrl ? (
        <Image
          source={{ uri: p.sourceImageUrl }}
          style={{ width: "100%", height: 240, borderRadius: 12 }}
          resizeMode="contain"
        />
      ) : (
        <Text style={{ opacity: 0.7 }}>（此筆沒有照片）</Text>
      )}

      {p.items.map((it, idx) => (
        <View
          key={`${p.prescriptionId}_${it.itemId ?? "noid"}_${idx}`}
          style={{ padding: 12, borderWidth: 1, borderRadius: 10, gap: 4 }}
        >
          <Text style={{ fontWeight: "800" }}>藥名：{it.drug_name_zh}</Text>
          <Text>劑量：{it.dose}</Text>
          <Text>時段：{it.time_of_day.join(", ")}</Text>
          {it.note_zh ? <Text>備註：{it.note_zh}</Text> : null}

          {/* 先留欄位：未來如果有翻譯/英文化 */}
          {it.drug_name_translated ? (
            <Text style={{ opacity: 0.75 }}>英文：{it.drug_name_translated}</Text>
          ) : null}
          {it.note_translated ? (
            <Text style={{ opacity: 0.75 }}>Note：{it.note_translated}</Text>
          ) : null}
        </View>
      ))}

      <Pressable onPress={() => router.back()} style={{ paddingVertical: 10 }}>
        <Text style={{ color: "#007AFF", fontSize: 18, fontWeight: "700" }}>
          回列表
        </Text>
      </Pressable>

      <Pressable onPress={() => router.replace("/caregiver")} style={{ paddingVertical: 10 }}>
        <Text style={{ color: "#007AFF", fontSize: 18, fontWeight: "700" }}>
          回看護首頁
        </Text>
      </Pressable>
    </ScrollView>
  );
}
