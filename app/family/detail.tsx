import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Image, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";

const TIME_LABELS: Record<string, string> = {
  morning: "早上",
  noon: "中午",
  afternoon: "下午",
  night: "晚上",
};

function toStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string" && v.trim()) return [v];
  return [];
}

export default function FamilyDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [loading, setLoading] = useState(true);
  const [p, setP] = useState<any | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setP(null);
      return;
    }

    (async () => {
      try {
        setLoading(true);

        const presRef = doc(db, "prescriptions", id);
        const presSnap = await getDoc(presRef);

        if (!presSnap.exists()) {
          setP(null);
          setLoading(false);
          return;
        }

        const data = presSnap.data() as any;

        const itemsQ = query(
          collection(db, "prescriptions", id, "items"),
          orderBy("__name__", "asc")
        );
        const itemsSnap = await getDocs(itemsQ);

        const items = itemsSnap.docs.map((d) => {
          const it = d.data() as any;

          const time_of_day =
            it.time_of_day
              ? toStringArray(it.time_of_day)
              : it.usage
              ? toStringArray(it.usage)
              : [];

          return {
            drug_name_zh: it.drug_name_zh ?? "",
            dose: it.dose ?? "",
            time_of_day,
            note_zh: it.note_zh ?? "",
          };
        });

        setP({
          prescriptionId: presSnap.id,
          title: data.title ?? "",
          sourceImageUrl: data.sourceImageUrl ?? "",
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
          items,
        });

        setLoading(false);
      } catch (e) {
        console.log("family detail read error:", e);
        setP(null);
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 20, gap: 12, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ opacity: 0.7 }}>讀取雲端資料中…</Text>
      </View>
    );
  }

  if (!p) {
    return (
      <View style={{ flex: 1, padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: "800" }}>找不到資料</Text>
        <Pressable onPress={() => router.replace("/family/list")}>
          <Text style={{ color: "#007AFF" }}>回列表</Text>
        </Pressable>
      </View>
    );
  }

  const goEdit = () => {
    router.push({
      pathname: "/family/edit",
      params: {
        id: p.prescriptionId,
        title: p.title || "",
        imageUri: p.sourceImageUrl || "",
        itemsJson: JSON.stringify(
          (p.items ?? []).map((it: any) => ({
            name: it.drug_name_zh,
            dose: it.dose,
            time: it.time_of_day,
            note: it.note_zh || "",
          }))
        ),
      },
    });
  };

  const confirmDelete = () => {
    Alert.alert("確認刪除", "這筆藥單紀錄將會永久移除。", [
      { text: "取消", style: "cancel" },
      {
        text: "確定刪除",
        style: "destructive",
        onPress: async () => {
          try {
            const presRef = doc(db, "prescriptions", p.prescriptionId);

            const itemsSnap = await getDocs(collection(db, "prescriptions", p.prescriptionId, "items"));
            const batch = writeBatch(db);
            itemsSnap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();

            await deleteDoc(presRef);

            router.replace("/family/list");
          } catch (e) {
            console.log("family delete error:", e);
            Alert.alert("刪除失敗", "請稍後再試");
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FFF" }}>
      {/* 統一 Header */}
      <View style={{ backgroundColor: "#007AFF", paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => router.back()} hitSlop={20}>
          <Text style={{ fontSize: 30, color: '#FFF', fontWeight: 'bold' }}>← 返回</Text>
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFF', marginLeft: 10 }}>藥單詳情</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 150, gap: 16 }}>
        <Text style={{ fontSize: 26, fontWeight: "900", color: "#333" }}>{p.title}</Text>
        
        {p.sourceImageUrl && (
          <Image
            source={{ uri: p.sourceImageUrl }}
            style={{ width: "100%", height: 250, borderRadius: 16, borderWidth: 1, borderColor: '#EEE' }}
            resizeMode="contain"
          />
        )}

        <Text style={{ fontSize: 20, fontWeight: "800", marginTop: 10 }}>藥品明細</Text>

        {(p.items ?? []).map((it: any, idx: number) => (
          <View key={idx} style={{
            padding: 16,
            borderWidth: 1.5,
            borderColor: "#333", // 統一深色邊框
            borderRadius: 12,
            backgroundColor: "#fff",
            marginBottom: 16
          }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#4A90E2", marginBottom: 8 }}>
              {it.drug_name_zh}
            </Text>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>用法劑量：{it.dose}</Text>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>服用時段：{it.time_of_day.join(", ")}</Text>
              <Text style={{ fontSize: 15, color: "#666", marginTop: 4 }}>
                備註：{it.note_zh || "無"}
              </Text>
            </View>
          </View>
        ))}

        <Pressable onPress={goEdit} style={{ backgroundColor: '#007AFF', padding: 18, borderRadius: 16, marginTop: 10 }}>
          <Text style={{ color: '#FFF', textAlign: 'center', fontSize: 18, fontWeight: '900' }}>編輯藥單資訊</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}