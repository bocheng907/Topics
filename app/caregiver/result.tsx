import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Button,
  Image,
  ActivityIndicator,
  ScrollView,
  Alert,
  Pressable,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "@/src/store/useStore";

type Item = { name: string; dose: string; time: string; note: string };

function safeParseItems(itemsJson?: string): Item[] | null {
  if (!itemsJson) return null;
  try {
    const data = JSON.parse(itemsJson);
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

export default function ResultScreen() {
  const { imageUri, itemsJson } = useLocalSearchParams<{ imageUri?: string; itemsJson?: string }>();
  const { addPrescription, updatePrescriptionImage, getPrescriptionsByCareTargetId } = useStore();

  const editedItems = useMemo(() => safeParseItems(itemsJson), [itemsJson]);

  const [status, setStatus] = useState<"loading" | "done">("loading");
  const [items, setItems] = useState<Item[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // ✅ 看護端也能在此頁看到「已送出紀錄」
  const history = getPrescriptionsByCareTargetId("ct_001");

  useEffect(() => {
    // ✅ 如果從「編輯頁」帶回 itemsJson，就直接顯示，不要再跑假解析
    if (editedItems && editedItems.length > 0) {
      setItems(editedItems);
      setStatus("done");
      return;
    }

    // 否則照你原本：UI 假裝解析：1.2 秒後出結果
    setStatus("loading");
    const t = setTimeout(() => {
      setItems([
        { name: "普拿疼", dose: "1 顆", time: "morning", note: "飯後" },
        { name: "胃藥", dose: "1 包", time: "night", note: "睡前" },
      ]);
      setStatus("done");
    }, 1200);

    return () => clearTimeout(t);
  }, [editedItems]);

  function goEdit() {
    if (status !== "done") return;
    router.push({
      pathname: "/caregiver/edit",
      params: {
        imageUri: imageUri ?? "",
        itemsJson: JSON.stringify(items),
      },
    });
  }

  async function onSubmit() {
    if (status !== "done") return;
    if (items.length === 0) {
      Alert.alert("沒有藥單項目", "items 是空的，無法送出。");
      return;
    }

    try {
      setSubmitting(true);

      // ✅ 寫入本地 store（之後換 Firebase，只動 store 層）
      const prescriptionId = addPrescription({
        careTargetId: "ct_001",
        sourceImageUrl: imageUri,
        status: "parsed",
        items: items.map((it) => ({
          itemId: "", // 交給 StoreProvider 自動補 id
          drug_name_zh: it.name,
          dose: it.dose,
          time_of_day: [it.time as any], // 目前先用 string，之後再嚴格對齊 TimeOfDay
          note_zh: it.note,
        })),
      });

      // ✅ 把照片複製到 app 私有目錄，避免原本的 imageUri（暫存路徑）失效
      if (imageUri) {
        const dir = `${FileSystem.documentDirectory}prescriptions/`;
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const dest = `${dir}${prescriptionId}.jpg`;

        await FileSystem.copyAsync({ from: imageUri, to: dest });

        // ✅ 更新 store：這樣家屬端 detail 才能用 p.sourceImageUrl 顯示照片
        updatePrescriptionImage(prescriptionId, dest);
      }

      Alert.alert("已送出", `已寫入本地 store（id: ${prescriptionId}）`);
      router.replace("/caregiver");
    } catch (e: any) {
      Alert.alert("送出失敗", e?.message ?? "未知錯誤");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>
        {status === "loading" ? "解析中…" : "電子藥單（解析結果）"}
      </Text>

      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{ width: "100%", height: 240, borderRadius: 12 }}
          resizeMode="contain"
        />
      ) : (
        <Text style={{ opacity: 0.7 }}>（沒有收到照片）</Text>
      )}

      {status === "loading" ? (
        <View style={{ padding: 16, borderWidth: 1, borderRadius: 12, gap: 10 }}>
          <ActivityIndicator />
          <Text style={{ textAlign: "center", opacity: 0.75 }}>
            正在辨識藥名與用法，請稍等…
          </Text>
        </View>
      ) : (
        <>
          {items.map((it, idx) => (
            <View key={idx} style={{ padding: 12, borderWidth: 1, borderRadius: 10, gap: 4 }}>
              <Text style={{ fontWeight: "700" }}>藥名：{it.name}</Text>
              <Text>劑量：{it.dose}</Text>
              <Text>時段：{it.time}</Text>
              <Text>備註：{it.note}</Text>
            </View>
          ))}

          <Button title="編輯 / 修正解析結果" onPress={goEdit} />

          <Button
            title={submitting ? "送出中…" : "確認送出 → 寫入本地 store"}
            onPress={onSubmit}
            disabled={submitting}
          />
        </>
      )}

      <Button title="回上一頁" onPress={() => router.back()} />
    </ScrollView>
  );
}
