import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { useStore } from "@/src/store/useStore";

/**
 * 家屬端：藥單列表
 * - 從本地 store 讀取
 * - 支援「單筆刪除（含確認視窗）」
 * - 不提供清空全部（避免誤刪）
 */
export default function ListScreen() {
  const {
    ready,
    getPrescriptionsByCareTargetId,
    removePrescription,
  } = useStore();

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>讀取本機資料中…</Text>
      </View>
    );
  }

  // 目前固定（之後可改成從登入者帶入）
  const list = getPrescriptionsByCareTargetId("ct_001");

  /** ✅ 單筆刪除（有確認視窗） */
  function confirmDelete(prescriptionId: string) {
    Alert.alert(
      "確認刪除",
      "確定要刪除這筆藥單嗎？此動作無法復原。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: () => removePrescription(prescriptionId),
        },
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "800" }}>藥單列表</Text>

      {list.length === 0 ? (
        <Text style={{ opacity: 0.7 }}>
          目前沒有藥單（請看護端先送出一筆）
        </Text>
      ) : (
        list.map((p) => (
          <View
            key={p.prescriptionId}
            style={{
              padding: 14,
              borderWidth: 1,
              borderRadius: 12,
              gap: 8,
            }}
          >
            <Text style={{ fontWeight: "800" }}>
              ID：{p.prescriptionId}
            </Text>
            <Text>狀態：{p.status}</Text>
            <Text>項目數：{p.items.length}</Text>

            {/* 查看詳情 */}
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/caregiver/detail",
                  params: { id: p.prescriptionId },
                })
              }
              style={{ paddingVertical: 6 }}
            >
              <Text
                style={{ color: "#007AFF", fontSize: 18, fontWeight: "700" }}
              >
                查看詳情
              </Text>
            </Pressable>

            {/* 刪除（含確認） */}
            <Pressable
              onPress={() => confirmDelete(p.prescriptionId)}
              style={{ paddingVertical: 6 }}
            >
              <Text
                style={{ color: "#FF3B30", fontSize: 18, fontWeight: "700" }}
              >
                刪除這筆
              </Text>
            </Pressable>
          </View>
        ))
      )}

      <Pressable
        onPress={() => router.replace("/caregiver")}
        style={{ paddingVertical: 10 }}
      >
        <Text style={{ color: "#007AFF", fontSize: 18, fontWeight: "700" }}>
          回看護首頁
        </Text>
      </Pressable>
    </ScrollView>
  );
}
