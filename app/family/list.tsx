import React from "react";
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { useStore } from "@/src/store/useStore";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";

export default function FamilyListScreen() {
  const { activeCareTargetId, activeCareTarget } = useActiveCareTarget();
  const storeAny = useStore() as any;
  const ready: boolean = !!storeAny.ready;

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>讀取本機資料中…</Text>
      </View>
    );
  }

  if (!activeCareTargetId) {
    return (
      <View style={{ flex: 1, padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "800" }}>請先選擇長輩</Text>
        <Pressable onPress={() => router.replace("/family")}>
          <Text style={{ color: "#007AFF" }}>前往選擇頁面</Text>
        </Pressable>
      </View>
    );
  }

  const list = storeAny.getPrescriptionsByCareTargetId(activeCareTargetId);

  const confirmDelete = (id: string) => {
    Alert.alert("確認刪除", "刪除後無法還原，確定嗎？", [
      { text: "取消", style: "cancel" },
      { text: "確定刪除", style: "destructive", onPress: () => storeAny.deletePrescription(id) },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop:90, gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "800" }}>藥單紀錄簿</Text>
      <Text style={{ opacity: 0.6 }}>長輩：{activeCareTarget?.name}</Text>

      {list.length === 0 ? (
        <Text style={{ marginTop: 40, textAlign: "center", opacity: 0.5 }}>
          目前沒有紀錄，請點選「掃描藥單」開始
        </Text>
      ) : (
        list.map((p: any) => (
          <View
            key={p.prescriptionId}
            style={{
              padding: 16,
              borderWidth: 1,
              borderRadius: 12,
              borderColor: "#ddd",
              backgroundColor: "#fff",
              gap: 4,
            }}
          >
            {/* ✅ 改為顯示自訂標題，若無標題則顯示預設字樣 */}
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#333" }}>
              {p.title || "未命名藥單"}
            </Text>
            
            <Text style={{ fontSize: 14, color: "#666" }}>
              日期：{new Date(p.createdAt).toLocaleDateString()}
            </Text>

            <Text style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>
              ID：{p.prescriptionId}
            </Text>

            <View style={{ flexDirection: "row", gap: 16, borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 8 }}>
              <Pressable
                onPress={() => router.push({ pathname: "/family/detail", params: { id: p.prescriptionId } })}
              >
                <Text style={{ color: "#007AFF", fontSize: 16, fontWeight: "700" }}>查看詳情</Text>
              </Pressable>

              <Pressable onPress={() => confirmDelete(p.prescriptionId)}>
                <Text style={{ color: "#FF3B30", fontSize: 16, fontWeight: "700" }}>刪除</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Pressable
        onPress={() => router.replace("/family")}
        style={{ marginTop: 20, padding: 16, backgroundColor: "#F2F2F7", borderRadius: 12 }}
      >
        <Text style={{ color: "#666", textAlign: "center", fontWeight: "700", fontSize: 16 }}>返回首頁</Text>
      </Pressable>
    </ScrollView>
  );
}