// 照顧者知識共享 — 顯示格式化工具
import { communityCopy } from "@/src/i18n/copy/communityCopy";
import type { Language } from "@/src/i18n/translations";

/**
 * 觀看數顯示規則（依規劃書 3-3）：
 * 1000 以下顯示實際數字，1000 以上簡化為 1.2K
 */
export function formatViewCount(count: number): string {
  if (!Number.isFinite(count) || count < 0) return "0";
  if (count < 1000) return String(Math.floor(count));
  const thousands = count / 1000;
  // 10K 以上不再顯示小數，避免數字過長擠壞版面
  if (thousands >= 10) return `${Math.floor(thousands)}K`;
  return `${(Math.floor(thousands * 10) / 10).toFixed(1)}K`;
}

/** 相對時間：剛剛 / N 分鐘前 / N 小時前 / N 天前，超過 7 天顯示日期（依介面語言） */
export function formatRelativeTime(createdAt: number, language: Language = "zh"): string {
  if (!Number.isFinite(createdAt)) return "";
  const c = communityCopy[language];

  const diffMs = Date.now() - createdAt;
  if (diffMs < 0) return c.justNow;

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return c.justNow;
  if (minutes < 60) return c.minutesAgo(minutes);

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return c.hoursAgo(hours);

  const days = Math.floor(hours / 24);
  if (days <= 7) return c.daysAgo(days);

  const date = new Date(createdAt);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

/** 由內容自動截取列表摘要 */
export function buildPreview(content: string, maxLength = 60): string {
  const flattened = content.replace(/\s+/g, " ").trim();
  if (flattened.length <= maxLength) return flattened;
  return `${flattened.slice(0, maxLength)}...`;
}
