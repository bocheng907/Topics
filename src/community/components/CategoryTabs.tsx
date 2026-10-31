// 分類切換（全部 / 照護技巧 / 用品資源 / 經驗交流）
// 各分類用自己的顏色：選取為該分類淺色底 + 深色字 + 勾勾，未選取為白底灰框 + 分類色圖示。
// 「全部」沿用主色藍。

import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { communityCategoryLabel, communityCopy } from "@/src/i18n/copy/communityCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { colors, radii, spacing } from "@/src/ui/theme";
import { getCategoryStyle, POST_CATEGORIES } from "../theme";
import type { CategoryFilter } from "../types";

type Props = {
  value: CategoryFilter;
  onChange: (next: CategoryFilter) => void;
};

const FILTERS: CategoryFilter[] = ["全部", ...POST_CATEGORIES];

function tabColors(filter: CategoryFilter) {
  if (filter === "全部") {
    return { main: colors.primary, bg: colors.primarySoft, border: colors.primaryBorder, icon: "apps-outline" as const };
  }
  const style = getCategoryStyle(filter);
  return { main: style.main, bg: style.bg, border: style.main, icon: style.icon };
}

export default function CategoryTabs({ value, onChange }: Props) {
  const { language } = useLanguage();
  const c = communityCopy[language];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.wrap}
      contentContainerStyle={styles.row}
    >
      {FILTERS.map((filter) => {
        const selected = filter === value;
        const tone = tabColors(filter);
        return (
          <Pressable
            key={filter}
            onPress={() => onChange(filter)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            hitSlop={{ top: 4, bottom: 4 }}
            style={({ pressed }) => [
              styles.chip,
              selected && { backgroundColor: tone.bg, borderColor: tone.border },
              pressed && !selected && styles.pressed,
            ]}
          >
            <Ionicons name={selected ? "checkmark" : tone.icon} size={16} color={tone.main} />
            <Text
              style={[styles.label, { color: selected ? tone.main : colors.textSecondary }, selected && styles.labelSelected]}
              numberOfLines={1}
            >
              {communityCategoryLabel(c, filter)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    flexGrow: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.surfaceSunken,
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
  },
  labelSelected: {
    fontWeight: "600",
  },
});
