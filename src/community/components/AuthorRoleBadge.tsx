// 發文者／留言者身分標籤（家屬／仲介），樣式沿用分類標籤的小膠囊
// 舊文章、舊留言沒有 authorRole，role 為 undefined 時不顯示

import { StyleSheet, Text, View } from "react-native";
import { COMMUNITY_COLORS } from "../theme";
import type { CommunityAuthorRole } from "../types";

const ROLE_STYLE: Record<CommunityAuthorRole, { label: string; main: string; bg: string }> = {
  family: { label: "家屬", main: COMMUNITY_COLORS.primary, bg: "#EEF0FC" },
  agency: { label: "仲介", main: "#0F7C80", bg: "#E3F3F3" },
};

type Props = {
  role?: CommunityAuthorRole;
};

export default function AuthorRoleBadge({ role }: Props) {
  if (!role) return null;
  const style = ROLE_STYLE[role];
  if (!style) return null;

  return (
    <View
      style={[styles.badge, { backgroundColor: style.bg }]}
      accessibilityLabel={`身分：${style.label}`}
    >
      <Text style={[styles.label, { color: style.main }]}>{style.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
  },
});
