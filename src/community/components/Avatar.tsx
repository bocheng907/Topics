// 姓名首字頭像
// 有頭像網址（users.avatarUrl）時改顯示圖片，否則顯示姓名首字（統一用主色淺底）

import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/src/ui/theme";

type Props = {
  name: string;
  size?: number;
  uri?: string;
};

export default function Avatar({ name, size = 32, uri }: Props) {
  const initial = name?.trim()?.charAt(0) || "?";

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceSunken }}
        contentFit="cover"
        transition={150}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View
      style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.initial, { fontSize: size * 0.45 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  initial: {
    color: colors.primary,
    fontWeight: "700",
  },
});
