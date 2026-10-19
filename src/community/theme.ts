// 照顧者知識共享 — 配色與分類視覺設定
// 沿用 Gemini 原型的色票（深藍主色 + 三分類色），並以 Ionicons 取代原型的 lucide 圖示

import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { PostCategory } from "./types";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export const COMMUNITY_COLORS = {
  // 主色改用家屬端既有的品牌紫（原型的深藍 #2C3E50 已淘汰），
  // 讓社群頁的按鈕、強調色與家屬端其他畫面同調
  primary: "#4F59D5",
  // header 色底：延續家屬端「每個功能一個色系」的作法，
  // 社群／知識分享取品牌紫的淺色調（與通知頁同系列，都屬資訊交流型畫面）
  headerBg: "#D9D4F3",
  background: "#FFFFFF",
  surface: "#F9FAFB",
  text: "#1F2937",
  textSecondary: "#6B7280",
  textLight: "#9CA3AF",
  border: "#E5E7EB",
  borderLight: "#F0F0F0",
  inputBg: "#F3F4F6",
  white: "#FFFFFF",
  danger: "#E74C3C",
  heart: "#F472B6",
} as const;

type CategoryStyle = {
  /** 主色：標籤文字、選取狀態底色 */
  main: string;
  /** 淺色底：標籤背景、熱門卡片背景 */
  bg: string;
  icon: IoniconName;
};

export const CATEGORY_STYLE: Record<PostCategory, CategoryStyle> = {
  照護技巧: { main: "#4A90E2", bg: "#EBF3FC", icon: "bulb-outline" },
  用品資源: { main: "#52B788", bg: "#EAF6EF", icon: "cart-outline" },
  經驗交流: { main: "#F4A261", bg: "#FDF2E9", icon: "heart-outline" },
};

/** 沒對到分類時的保底樣式，避免舊資料或未知分類讓畫面壞掉 */
export const FALLBACK_CATEGORY_STYLE: CategoryStyle = {
  main: COMMUNITY_COLORS.textSecondary,
  bg: COMMUNITY_COLORS.border,
  icon: "pricetag-outline",
};

export function getCategoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLE[category as PostCategory] ?? FALLBACK_CATEGORY_STYLE;
}

/** 三個分類的固定順序，發文頁與分類切換共用 */
export const POST_CATEGORIES: PostCategory[] = ["照護技巧", "用品資源", "經驗交流"];
