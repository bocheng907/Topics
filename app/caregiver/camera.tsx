import { useState } from "react";
import { View, Text, Image, Alert, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { uploadPrescriptionImage } from "@/firebase/uploadPrescriptionImage";
import { useAuth } from "@/src/auth/useAuth";
import { analyzePrescriptionByUrl } from "@/src/api/analyzePrescription";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";

export default function CameraScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const { user } = useAuth();

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("需要相簿權限", "請允許 App 讀取相簿，才能選取藥單照片。");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsEditing: true,
    });
    if (result.canceled) return;
    setImageUri(result.assets?.[0]?.uri ?? null);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("需要相機權限", "請允許使用相機，才能拍攝藥單照片。");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: true,
    });
    if (result.canceled) return;
    setImageUri(result.assets?.[0]?.uri ?? null);
  }

  async function goNext() {
    if (!imageUri) {
      Alert.alert("還沒選照片", "請先拍攝或選取一張藥單照片。");
      return;
    }

    if (!user) {
      Alert.alert("尚未登入", "請先登入再上傳藥單");
      return;
    }

    try {
      // 1️⃣ 上傳圖片到 Firebase Storage
      const downloadURL = await uploadPrescriptionImage(imageUri, user.uid);

      // 2️⃣ 呼叫 FastAPI AI
      const analyzeResult = await analyzePrescriptionByUrl(downloadURL);

      // 3️⃣ 寫入 Firestore
      const docRef = await addDoc(collection(db, "prescriptions"), {
        imageUrl: downloadURL,
        analyzeResult,
        caregiverUid: user.uid,
        createdAt: serverTimestamp(),
      });

      // 4️⃣ 導頁
      router.replace({
        pathname: "/caregiver/result",
        params: {
          prescriptionId: docRef.id,
        },
      });

    } catch (e: any) {
      const msg = e?.message ?? "";

      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
        Alert.alert(
          "AI 服務暫時無法使用",
          "目前 AI 解析請求次數已達上限，請稍後再試。"
        );
      } else {
        Alert.alert(
          "處理失敗",
          "藥單解析失敗，請重新拍攝或稍後再試。"
        );
      }
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 90, gap: 20 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 28, fontWeight: "900", color: "#333" }}>
          上傳藥單
        </Text>
        <Text style={{ fontSize: 16, color: "#666" }}>
          請拍攝清晰的藥單，AI 將為您解析內容
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <Pressable
          onPress={takePhoto}
          style={({ pressed }) => ({
            flexDirection: "row",
            paddingVertical: 18,
            backgroundColor: "#007AFF",
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.8 : 1,
            gap: 10,
          })}
        >
          <Text style={{ fontSize: 18, fontWeight: "900", color: "#fff" }}>
            📷 開相機拍攝
          </Text>
        </Pressable>

        <Pressable
          onPress={pickImage}
          style={({ pressed }) => ({
            paddingVertical: 18,
            borderWidth: 2,
            borderColor: "#007AFF",
            borderRadius: 14,
            alignItems: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 18, fontWeight: "900", color: "#007AFF" }}>
            🖼️ 從相簿選取
          </Text>
        </Pressable>
      </View>

      {imageUri ? (
        <View style={{ gap: 16, marginTop: 10 }}>
          <View
            style={{
              padding: 8,
              backgroundColor: "#F2F2F7",
              borderRadius: 16,
            }}
          >
            <Image
              source={{ uri: imageUri }}
              style={{ width: "100%", height: 380, borderRadius: 12 }}
              resizeMode="contain"
            />
          </View>

          <Pressable
            onPress={goNext}
            style={{
              paddingVertical: 18,
              backgroundColor: "#34C759",
              borderRadius: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "900", color: "#fff" }}>
              確認照片，開始解析 →
            </Text>
          </Pressable>
        </View>
      ) : (
        <View
          style={{
            padding: 60,
            borderStyle: "dashed",
            borderWidth: 2,
            borderColor: "#DDD",
            borderRadius: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#AAA", fontWeight: "700" }}>
            尚未選取照片
          </Text>
        </View>
      )}

      <Pressable
        onPress={() => router.replace("/caregiver")}
        style={{ marginTop: 10 }}
      >
        <Text
          style={{
            color: "#666",
            textAlign: "center",
            fontWeight: "700",
            fontSize: 16,
          }}
        >
          取消並返回
        </Text>
      </Pressable>
    </ScrollView>
  );
}
