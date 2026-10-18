// 照顧者知識共享 — 發文前的敏感字詞檢查（依規劃書 4-2）
// 設計原則：只警告、不封鎖，讓使用者自己修改內容

/** A. 廣告類 */
const AD_KEYWORDS = [
  "加賴", "加LINE", "加line", "私訊優惠", "代購", "代辦",
  "便宜賣", "限時優惠", "點我購買", "歡迎私訊", "業配",
];

/** B. 攻擊類（含針對外籍看護的歧視字眼） */
const ABUSE_KEYWORDS = [
  "白痴", "智障", "廢物", "去死", "滾出去",
  "外勞", "番仔", "死老人",
];

/** C. 醫療高風險類 */
const MEDICAL_RISK_KEYWORDS = [
  "保證治好", "一定痊癒", "不用看醫生", "偏方", "祖傳秘方",
  "包治", "根治保證", "停藥就會好",
];

const ALL_KEYWORDS = [...AD_KEYWORDS, ...ABUSE_KEYWORDS, ...MEDICAL_RISK_KEYWORDS];

export type ContentCheckResult = {
  passed: boolean;
  /** 命中的字詞，用於提示使用者要修哪裡 */
  matched: string[];
  message: string;
};

/**
 * 檢查標題與內容是否包含敏感字詞
 * 比對時忽略大小寫，避免 "加LINE" / "加line" 被繞過
 */
export function checkPostContent(title: string, content: string): ContentCheckResult {
  const haystack = `${title}\n${content}`.toLowerCase();
  const matched = ALL_KEYWORDS.filter((word) => haystack.includes(word.toLowerCase()));

  // 同一個字詞可能同時出現在標題與內容，去重後再提示
  const unique = [...new Set(matched)];

  if (unique.length === 0) {
    return { passed: true, matched: [], message: "" };
  }

  return {
    passed: false,
    matched: unique,
    message: `內容包含以下不適合的字詞，請修改後再發布：\n${unique.join("、")}`,
  };
}
