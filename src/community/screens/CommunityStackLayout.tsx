// 照顧者知識共享 — 路由設定
// 各畫面自己畫 header（與家屬端其他頁面一致），所以關掉原生 header
import { Stack } from "expo-router";

export default function CommunityLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="my-posts" />
      {/* 發文頁用由下往上的動畫，符合原型的 slideUp 效果 */}
      <Stack.Screen name="new-post" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
    </Stack>
  );
}
