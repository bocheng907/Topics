// 照顧者知識共享 — 顯示格式化工具

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

/** 相對時間：剛剛 / N 分鐘前 / N 小時前 / N 天前，超過 7 天顯示日期 */
export function formatRelativeTime(createdAt: number): string {
  if (!Number.isFinite(createdAt)) return "";

  const diffMs = Date.now() - createdAt;
  if (diffMs < 0) return "剛剛";

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "剛剛";
  if (minutes < 60) return `${minutes} 分鐘前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;

  const days = Math.floor(hours / 24);
  if (days <= 7) return `${days} 天前`;

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
