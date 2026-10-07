// 分類切換（全部 / 照護技巧 / 用品資源 / 經驗交流）
// 選取時以該分類主色填滿，未選取為白底灰框

import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { COMMUNITY_COLORS, POST_CATEGORIES, getCategoryStyle } from "../theme";
import type { CategoryFilter } from "../types";

type Props = {
  value: CategoryFilter;
  onChange: (next: CategoryFilter) => void;
};

const FILTERS: CategoryFilter[] = ["全部", ...POST_CATEGORIES];

export default function CategoryTabs({ value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.wrap}
      contentContainerStyle={styles.row}
    >
      {FILTERS.map((filter) => {
        const isActive = filter === value;
        // 「全部」沒有分類色，使用深藍主色
        const activeColor =
          filter === "全部" ? COMMUNITY_COLORS.primary : getCategoryStyle(filter).main;

        return (
          <Pressable
            key={filter}
            onPress={() => onChange(filter)}
            style={[
              styles.chip,
              isActive
                ? { backgroundColor: activeColor, borderColor: activeColor }
                : styles.chipInactive,
            ]}
          >
            <Text style={[styles.chipText, isActive ? styles.chipTextActive : styles.chipTextInactive]}>
              {filter}
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    flexShrink: 0,
    flexGrow: 0,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipInactive: {
    backgroundColor: COMMUNITY_COLORS.white,
    borderColor: COMMUNITY_COLORS.border,
  },
  chipText: {
    fontSize: 15,
  },
  chipTextActive: {
    color: COMMUNITY_COLORS.white,
    fontWeight: "700",
  },
  chipTextInactive: {
    color: COMMUNITY_COLORS.textSecondary,
    fontWeight: "600",
  },
});
