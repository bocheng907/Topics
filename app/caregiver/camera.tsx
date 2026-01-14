import { useState } from "react";
import { View, Text, Button, Image, Alert, ScrollView } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";

export default function CameraScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);

  async function pickImage() {
    // iOS 相簿權限
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

    const uri = result.assets?.[0]?.uri ?? null;
    setImageUri(uri);
  }

  async function takePhoto() {
    // ✅ 相機權限
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("需要相機權限", "請允許使用相機，才能拍攝藥單照片。");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: true,
      // 可選：固定比例（藥單直式通常 3:4 / 4:5）
      // aspect: [3, 4],
    });

    if (result.canceled) return;
    setImageUri(result.assets?.[0]?.uri ?? null);
  }


  function goNext() {
    if (!imageUri) {
      Alert.alert("還沒選照片", "請先從相簿選一張藥單照片。");
      return;
    }

    // 先用 query 傳給下一頁（UI demo 用）
    router.push({
      pathname: "/caregiver/result",
      params: { imageUri },
    });
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>拍藥單 / 選照片</Text>
      <Text style={{ opacity: 0.7 }}>
        上傳一張照片 → 預覽 → 下一步（解析）
      </Text>

      <Button title="📷 開相機拍藥單" onPress={takePhoto} />
      <Button title="🖼️ 從相簿選藥單" onPress={pickImage} />

      {imageUri ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontWeight: "600" }}>預覽：</Text>
          <Image
            source={{ uri: imageUri }}
            style={{ width: "100%", height: 380, borderRadius: 12 }}
            resizeMode="contain"
          />
          <Button title="下一步（到解析結果頁）" onPress={goNext} />
        </View>
      ) : (
        <Text style={{ marginTop: 10, opacity: 0.7 }}>
          尚未選取照片
        </Text>
      )}

      <Button title="回看護首頁" onPress={() => router.replace("/caregiver")} />
    </ScrollView>
  );
}
