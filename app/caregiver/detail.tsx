import { View, Text, Pressable, ScrollView, Image, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "@/src/store/useStore";

// ✅ 1. 定義中文轉換對照表
const TIME_LABELS: Record<string, string> = {
  morning: "早上",
  noon: "中午",
  afternoon: "下午",
  night: "晚上",
};

export default function FamilyDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getPrescriptionById, deletePrescription } = useStore();

  const p = id ? getPrescriptionById(id) : undefined;

  if (!p) {
    return (
      <View style={{ flex: 1, padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: "800" }}>找不到資料</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: "#007AFF" }}>回列表</Text>
        </Pressable>
      </View>
    );
  }

  // ✅ 2. 編輯功能：確保傳入 id 避免重複創建
  const goEdit = () => {
    router.push({
      pathname: "/caregiver/edit",
      params: {
        id: p.prescriptionId,
        title: p.title || "",
        imageUri: p.sourceImageUrl || "",
        itemsJson: JSON.stringify(p.items.map(it => ({
          name: it.drug_name_zh,
          dose: it.dose,
          time: it.time_of_day, 
          note: it.note_zh || ""
        }))),
      },
    });
  };

  const confirmDelete = () => {
    Alert.alert("確認刪除", "這筆藥單紀錄將會永久移除。", [
      { text: "取消", style: "cancel" },
      { 
        text: "確定刪除", 
        style: "destructive", 
        onPress: () => {
          deletePrescription(p.prescriptionId);
          router.back();
        } 
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 90, gap: 16 }}>
      {/* ✅ 3. 標題區塊：顯示自訂標題 */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 26, fontWeight: "900", color: "#333" }}>
            {p.title || "藥單詳情"}
          </Text>
          <Text style={{ opacity: 0.5, marginTop: 4 }}>
            錄入日期：{new Date(p.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <Pressable
          onPress={goEdit} 
          style={({ pressed }) => ({
            paddingHorizontal: 15,
            paddingVertical: 10,
            backgroundColor: pressed ? '#CFDFFF' : '#E1E9FF',
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
            minWidth: 60,
          })}
        >
          <Text style={{ color: '#007AFF', fontWeight: '800', fontSize: 16 }}>編輯</Text>
        </Pressable>
      </View>

      {p.sourceImageUrl && (
        <Image 
          source={{ uri: p.sourceImageUrl }} 
          style={{ width: "100%", height: 300, borderRadius: 12, backgroundColor: "#eee" }} 
          resizeMode="contain" 
        />
      )}

      <Text style={{ fontSize: 20, fontWeight: "800", marginTop: 10 }}>藥品明細</Text>

      {p.items.map((it, idx) => (
        <View 
          key={idx} 
          style={{ padding: 14, borderWidth: 1, borderColor: "#eee", borderRadius: 12, backgroundColor: "#fff", gap: 4 }}
        >
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#007AFF" }}>
            {it.drug_name_zh}
          </Text>
          <Text style={{ fontSize: 16 }}>用法劑量：{it.dose}</Text>
          
          {/* ✅ 4. 使用對照表將英文時段轉為中文 */}
          <Text style={{ fontSize: 16 }}>
            服用時段：{it.time_of_day.map(t => TIME_LABELS[t] || t).join(", ")}
          </Text>
          
          <Text style={{ fontSize: 15, color:it.note_zh && it.note_zh.trim() !== "" ? "#666" : "#CCC", marginTop: 4 }}>
            備註：{it.note_zh && it.note_zh.trim() !== "" ? it.note_zh : "無"}
          </Text>
        </View>
      ))}

      <View style={{ marginTop: 20, gap: 12 }}>
        <Pressable onPress={() => router.back()} style={{ padding: 16, backgroundColor: "#007AFF", borderRadius: 12 }}>
          <Text style={{ color: "#fff", textAlign: "center", fontSize: 18, fontWeight: "700" }}>返回列表</Text>
        </Pressable>

        <Pressable onPress={confirmDelete} style={{ padding: 12 }}>
          <Text style={{ color: "#FF3B30", textAlign: "center", fontWeight: "600" }}>刪除此筆紀錄</Text>
        </Pressable>
        
        {/* 把 ID 放在最下面不起眼的地方供開發參考 */}
        <Text style={{ textAlign: 'center', fontSize: 10, color: '#ccc' }}>ID: {p.prescriptionId}</Text>
      </View>
    </ScrollView>
  );
}