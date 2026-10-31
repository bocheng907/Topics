// 分類切換（全部 / 照護技巧 / 用品資源 / 經驗交流）
// 使用共用 Chip：選取為主色淺底 + 勾勾，未選取為白底灰框

import { ScrollView, StyleSheet } from "react-native";
import { communityCategoryLabel, communityCopy } from "@/src/i18n/copy/communityCopy";
import { useLanguage } from "@/src/store/LanguageContext";
import { Chip } from "@/src/ui/components";
import { spacing } from "@/src/ui/theme";
import { POST_CATEGORIES } from "../theme";
import type { CategoryFilter } from "../types";

type Props = {
  value: CategoryFilter;
  onChange: (next: CategoryFilter) => void;
};

const FILTERS: CategoryFilter[] = ["全部", ...POST_CATEGORIES];

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
      {FILTERS.map((filter) => (
        <Chip
          key={filter}
          label={communityCategoryLabel(c, filter)}
          selected={filter === value}
          onPress={() => onChange(filter)}
          style={styles.chip}
        />
      ))}
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
  },
});
