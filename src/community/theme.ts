// 照顧者知識共享 — 配色與分類視覺設定
// 配色全部改用 src/ui/theme.ts 的設計 token（主色為低飽和藍）。
// 只有分類標籤／分類切換保留各自的顏色（淺色底 + 同色系深字，皆達 WCAG AA），
// 其餘社群畫面一律使用主色藍。

import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { colors } from "@/src/ui/theme";
import type { PostCategory } from "./types";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

/** Kept for existing imports; every value maps to a design token. */
export const COMMUNITY_COLORS = {
  primary: colors.primary,
  headerBg: colors.surface,
  background: colors.surface,
  surface: colors.canvas,
  text: colors.text,
  textSecondary: colors.textSecondary,
  textLight: colors.textMuted,
  border: colors.border,
  borderLight: colors.divider,
  inputBg: colors.surfaceSunken,
  white: colors.surface,
  danger: colors.danger,
  /** Liked state; uses the brand primary instead of a separate pink. */
  heart: colors.primary,
} as const;

type CategoryStyle = {
  /** 標籤文字 / 圖示顏色 */
  main: string;
  /** 標籤背景 */
  bg: string;
  icon: IoniconName;
};

const NEUTRAL = { main: colors.textSecondary, bg: colors.surfaceSunken } as const;

// 由舊版的藍 / 綠 / 橘重新調成低飽和淺色調；文字對背景對比約 5.2–5.5:1。
export const CATEGORY_STYLE: Record<PostCategory, CategoryStyle> = {
  照護技巧: { main: "#2B6198", bg: "#E5EFF9", icon: "bulb-outline" },
  用品資源: { main: "#2E7046", bg: "#E4F3EA", icon: "cart-outline" },
  經驗交流: { main: "#9A4E12", bg: "#FCEFE3", icon: "chatbubbles-outline" },
};

/** 沒對到分類時的保底樣式，避免舊資料或未知分類讓畫面壞掉 */
export const FALLBACK_CATEGORY_STYLE: CategoryStyle = {
  ...NEUTRAL,
  icon: "pricetag-outline",
};

export function getCategoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLE[category as PostCategory] ?? FALLBACK_CATEGORY_STYLE;
}

/** 三個分類的固定順序，發文頁與分類切換共用 */
export const POST_CATEGORIES: PostCategory[] = ["照護技巧", "用品資源", "經驗交流"];
