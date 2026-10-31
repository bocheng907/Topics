// 照顧者知識共享 — 配色與分類視覺設定
// 配色全部改用 src/ui/theme.ts 的設計 token（主色為低飽和藍）。
// 分類不再各自一個顏色：名稱 + 圖示已足以區分，標籤統一用中性樣式。

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

export const CATEGORY_STYLE: Record<PostCategory, CategoryStyle> = {
  照護技巧: { ...NEUTRAL, icon: "bulb-outline" },
  用品資源: { ...NEUTRAL, icon: "cart-outline" },
  經驗交流: { ...NEUTRAL, icon: "chatbubbles-outline" },
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
