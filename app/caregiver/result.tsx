import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";

// ====== 型別（不影響 UI） ======
type Item = {
  name: string;
  dose: string;
  time: string[];
  note: string;
};
function mapMedicineFromAI(m: any): Item {
  return {
    name:
      m.name ??
      m.drug_name ??
      m.drug_name_en ??
      m.medicine_name ??
      "",
    dose:
      m.dose ??
      m.dose_text ??
      m.dosage ??
      "",
    time:
      m.time ??
      m.time_of_day ??
      (m.frequency ? [m.frequency] : []),
    note:
      m.note ??
      m.note_zh ??
      "",
  };
}


const TIME_LABELS: Record<string, string> = {
  morning: "早上",
  noon: "中午",
  afternoon: "下午",
  night: "晚上",
};

export default function ResultScreen() {
  // ✅ 現在只接受 prescriptionId
  const { prescriptionId } = useLocalSearchParams<{ prescriptionId?: string }>();

  const { activeCareTargetId } = useActiveCareTarget();

  // ====== UI 原本就有的 state（保留） ======
  const [status, setStatus] = useState<"loading" | "done">("loading");
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState("");
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);

  // ====== 從 Firestore 讀資料（唯一新增邏輯） ======
  useEffect(() => {
    if (!prescriptionId) {
      Alert.alert("錯誤", "缺少藥單 ID");
      router.replace("/caregiver");
      return;
    }

    (async () => {
      try {
        const ref = doc(db, "prescriptions", prescriptionId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          Alert.alert("錯誤", "找不到藥單資料");
          router.replace("/caregiver");
          return;
        }

        const data = snap.data();

        // 🔽 對應回你原本 UI 需要的資料格式
        setImageUri(data.imageUrl);
        setTitle(data.title ?? "");
        const meds = data.analyzeResult?.medicines ?? [];
setItems(meds.map(mapMedicineFromAI));


        setStatus("done");
      } catch (e) {
        Alert.alert("讀取失敗", "無法讀取藥單資料");
        router.replace("/caregiver");
      }
    })();
  }, [prescriptionId]);

  // ====== UI（完全照你原本的） ======
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 90, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "900", color: "#333" }}>
        {status === "loading" ? "解析中..." : "確認藥單資訊"}
      </Text>

      {imageUri && (
        <Image
          source={{ uri: imageUri }}
          style={{
            width: "100%",
            height: 200,
            borderRadius: 12,
            backgroundColor: "#eee",
          }}
          resizeMode="contain"
        />
      )}

      {status === "loading" ? (
        <View style={{ padding: 40, alignItems: "center" }}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={{ marginTop: 10, opacity: 0.6 }}>
            AI 正在努力解析中...
          </Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontWeight: "800", fontSize: 16 }}>紀錄標題</Text>
            <TextInput
              value={title}
              editable={false} // ❗ UI 不變，只是唯讀
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                padding: 12,
                backgroundColor: "#f5f5f5",
              }}
            />
          </View>

          <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 8 }}>
            藥品明細
          </Text>

          {items.map((it, idx) => (
            <View
              key={idx}
              style={{
                padding: 16,
                borderWidth: 1,
                borderColor: "#eee",
                borderRadius: 12,
                backgroundColor: "#fff",
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: "#007AFF",
                }}
              >
                {it.name}
              </Text>
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 15, color: "#444" }}>
                  用法劑量：{it.dose}
                </Text>
                <Text style={{ fontSize: 15, color: "#444" }}>
                  服用時段：
                  {it.time.map(t => TIME_LABELS[t] || t).join(", ")}
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    color:
                      it.note && it.note.trim() !== "" ? "#666" : "#CCC",
                    marginTop: 2,
                  }}
                >
                  備註：
                  {it.note && it.note.trim() !== "" ? it.note : "無"}
                </Text>
              </View>
            </View>
          ))}

          <View style={{ marginTop: 20, gap: 12 }}>
            <Pressable
              onPress={() => router.replace("/caregiver/list")}
              style={{
                padding: 18,
                backgroundColor: "#007AFF",
                borderRadius: 12,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  textAlign: "center",
                  fontWeight: "800",
                  fontSize: 18,
                }}
              >
                返回藥單列表
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
