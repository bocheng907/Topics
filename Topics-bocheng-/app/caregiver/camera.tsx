import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  Alert,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { uploadPrescriptionImage } from "@/firebase/uploadPrescriptionImage";
import { useAuth } from "@/src/auth/useAuth";
import { analyzePrescriptionByUrl } from "@/src/api/analyzePrescription";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";

export default function CameraScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const { user } = useAuth();
  const { activeCareTargetId } = useActiveCareTarget();

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("需要相簿權限", "請允許 App 讀取相簿，才能選取藥單照片。");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

    if (!activeCareTargetId) {
      Alert.alert("尚未選擇長輩", "請先選擇長輩再上傳藥單。");
      return;
    }

    try {
      console.log("[1] uploading image...");
      console.log("[1] auth user.uid =", user.uid);
      console.log("[1] activeCareTargetId =", activeCareTargetId);
      console.log("[1] local imageUri =", imageUri);

      const downloadURL = await uploadPrescriptionImage(imageUri, user.uid);
      console.log("[1] downloadURL:", downloadURL);

      console.log("[2] analyzing prescription...");
      const analyzeResult = await analyzePrescriptionByUrl(downloadURL);
      console.log("[2] analyzeResult:", analyzeResult);

      const safe = JSON.parse(JSON.stringify(analyzeResult ?? {}));

      const draftTitle = safe.clinic_name ?? "未命名藥單";

      console.log("[3] navigate to result draft...");
      console.log("[3] draftTitle =", draftTitle);

      router.replace({
        pathname: "/caregiver/result",
        params: {
          imageUrl: downloadURL,
          draftTitle,
          analyzeResult: JSON.stringify(safe),
        },
      });
    } catch (e: any) {
      console.log("❌ ERROR:", e);
      console.log("❌ MESSAGE:", e?.message);

      const msg = String(e?.message ?? e ?? "");

      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
        Alert.alert(
          "AI 服務暫時無法使用",
          "目前 AI 解析請求次數已達上限，請稍後再試。"
        );
        return;
      }

      Alert.alert("處理失敗", msg || "未知錯誤（請查看 console）");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>上傳藥單</Text>
        <Text style={styles.subtitle}>
          請拍攝清晰的藥單，AI 將為您解析內容
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable onPress={takePhoto} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>📷 開相機拍攝</Text>
        </Pressable>

        <Pressable onPress={pickImage} style={styles.outlineBtn}>
          <Text style={styles.outlineBtnText}>🖼️ 從相簿選取</Text>
        </Pressable>
      </View>

      {imageUri ? (
        <View style={styles.previewWrap}>
          <View style={styles.previewCard}>
            <Image
              source={{ uri: imageUri }}
              style={styles.previewImg}
              resizeMode="contain"
            />
          </View>

          <Pressable onPress={goNext} style={styles.successBtn}>
            <Text style={styles.successBtnText}>
              確認照片，開始解析 →
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>尚未選取照片</Text>
        </View>
      )}

      <Pressable
        onPress={() => router.replace("/caregiver")}
        style={styles.back}
      >
        <Text style={styles.backText}>取消並返回</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 90, paddingBottom: 40 },

  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "900", color: "#333" },
  subtitle: { marginTop: 6, fontSize: 16, color: "#666" },

  actions: { marginBottom: 20 },

  primaryBtn: {
    paddingVertical: 18,
    backgroundColor: "#007AFF",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  primaryBtnText: { fontSize: 18, fontWeight: "900", color: "#fff" },

  outlineBtn: {
    paddingVertical: 18,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 14,
    alignItems: "center",
  },
  outlineBtnText: { fontSize: 18, fontWeight: "900", color: "#007AFF" },

  previewWrap: { marginTop: 10 },
  previewCard: {
    padding: 8,
    backgroundColor: "#F2F2F7",
    borderRadius: 16,
    marginBottom: 16,
  },
  previewImg: { width: "100%", height: 380, borderRadius: 12 },

  successBtn: {
    paddingVertical: 18,
    backgroundColor: "#34C759",
    borderRadius: 14,
    alignItems: "center",
  },
  successBtnText: { fontSize: 18, fontWeight: "900", color: "#fff" },

  emptyBox: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: "#DDD",
    borderRadius: 16,
    alignItems: "center",
  },
  emptyText: { color: "#AAA", fontWeight: "700" },

  back: { marginTop: 16 },
  backText: {
    color: "#666",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
  },
});