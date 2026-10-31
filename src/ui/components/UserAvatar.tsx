// 共用使用者頭像
// 有頭像網址且載入成功 → 圓形圖片；否則顯示 Gmail 式字首頭像：
// 依 uid（沒有時用名稱）固定挑一個背景色 + 名稱第一個字；沒有名稱時顯示人像圖示。

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/src/ui/theme";

export type UserAvatarProps = {
  uri?: string | null;
  name?: string | null;
  uid?: string | null;
  size?: number;
  accessibilityLabel?: string;
};

/**
 * 柔和但可讀的字首底色，與主色藍協調；白字對比皆 ≥ 4.8:1（WCAG AA）。
 * 順序固定：改動會讓既有使用者的頭像顏色改變。
 */
export const AVATAR_PALETTE = [
  "#44709E", // 主色藍
  "#2F7A78", // 青綠
  "#5B6FB5", // 靛藍
  "#7A5BA6", // 紫
  "#A0526E", // 玫瑰
  "#9A5B2E", // 琥珀棕
  "#3F7D4F", // 綠
  "#5F6B7A", // 石板灰
] as const;

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function avatarColor(key: string) {
  return AVATAR_PALETTE[hashString(key) % AVATAR_PALETTE.length];
}

/** 第一個字（以 code point 切，CJK / emoji 不會被切半）；拉丁字母轉大寫 */
export function avatarInitial(name?: string | null) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "";
  const first = Array.from(trimmed)[0] ?? "";
  return first.toLocaleUpperCase();
}

export default function UserAvatar({ uri, name, uid, size = 40, accessibilityLabel }: UserAvatarProps) {
  const cleanUri = typeof uri === "string" && /^https?:\/\//.test(uri.trim()) ? uri.trim() : "";
  const [failedUri, setFailedUri] = useState<string | null>(null);
  useEffect(() => setFailedUri(null), [cleanUri]);

  const round = { width: size, height: size, borderRadius: size / 2 };
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: "image" as const, accessibilityLabel }
    : { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const };

  if (cleanUri && failedUri !== cleanUri) {
    return (
      <View style={[round, styles.imageWrap]} {...a11y}>
        <Image
          source={{ uri: cleanUri }}
          style={round}
          contentFit="cover"
          transition={150}
          onError={() => setFailedUri(cleanUri)}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  const initial = avatarInitial(name);
  if (!initial) {
    return (
      <View style={[round, styles.center, styles.neutral]} {...a11y}>
        <Ionicons name="person" size={Math.round(size * 0.55)} color={colors.textMuted} />
      </View>
    );
  }

  const key = (uid ?? "").trim() || (name ?? "").trim();
  return (
    <View style={[round, styles.center, { backgroundColor: avatarColor(key) }]} {...a11y}>
      <Text
        style={[styles.initial, { fontSize: Math.round(size * 0.44), lineHeight: Math.round(size * 0.56) }]}
        allowFontScaling={false}
      >
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  imageWrap: {
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  neutral: {
    backgroundColor: colors.surfaceSunken,
  },
  initial: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
