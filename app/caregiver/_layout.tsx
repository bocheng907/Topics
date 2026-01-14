import { Stack } from "expo-router";

export default function CaregiverLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "看護端" }} />
      <Stack.Screen name="camera" options={{ title: "拍藥單 / 選照片" }} />
      <Stack.Screen name="result" options={{ title: "解析結果" }} />
      <Stack.Screen name="list" options={{ title: "藥單列表" }} />
      <Stack.Screen name="detail" options={{ title: "藥單詳情" }} />
    </Stack>
  );
}
