export type ExportStage = "reauth" | "token" | "request" | "validate" | "save";

// Never display or log raw errors: messages can contain URLs or personal data.
export function exportDiagnostic(error: unknown, stage: ExportStage) {
  const e = error as {code?: unknown; message?: unknown} | null;
  const allowed = ["auth/wrong-password", "auth/invalid-credential", "auth/too-many-requests",
    "auth/network-request-failed", "auth/user-disabled", "auth/user-token-expired",
    "functions/unauthenticated", "functions/failed-precondition", "functions/permission-denied",
    "functions/resource-exhausted", "functions/unavailable", "functions/deadline-exceeded",
    "functions/internal", "functions/not-found", "functions/invalid-argument"];
  const code = typeof e?.code === "string" && allowed.includes(e.code) ? e.code : "unknown";
  const known: Record<string, string> = {
    "Unique profile required.": "profile",
    "Recent authentication is required.": "recent-auth",
    "Export rate limit reached.": "rate",
    "Export too large.": "size",
    "Too many linked patients.": "size",
    "Export too deep.": "size",
    "Account not available.": "access",
    "Access changed; retry.": "access",
    "invalid-export": "payload",
    "wrong-export-owner": "payload",
    "sharing-unavailable": "sharing",
  };
  const reason = typeof e?.message === "string" && Object.hasOwn(known, e.message)
    ? known[e.message] : code.includes("network") || code.endsWith("/unavailable") ||
      code.endsWith("/deadline-exceeded") ? "network" :
      code.endsWith("/unauthenticated") ? "recent-auth" :
      code.endsWith("/permission-denied") ? "access" : "unknown";
  return {stage, code, reason, id: "EXPORT/" + stage + "/" + reason + "/" + code};
}

const hints: Record<string, string> = {
  profile: "帳號資料缺少或有重複，請聯絡團隊檢查，不要連續重試。",
  "recent-auth": "登入驗證已失效，請重新登入後再試。",
  rate: "已達每小時 3 次限制，請等一小時後再試，避免連續按。",
  size: "資料超過匯出上限，請聯絡團隊協助。",
  access: "帳號狀態或資料存取權已變更，請聯絡團隊檢查。",
  payload: "匯出結果未通過完整性檢查，已停止提供檔案。",
  sharing: "此裝置無法開啟分享，請改用網頁版下載。",
  network: "網路連線失敗或服務逾時，請確認連線後再試。",
};
export function exportDiagnosticHint(reason: string, language: string): string {
  return language === "zh" ? hints[reason] || "請將下方診斷代碼提供給團隊，先不要連續重試。" : "";
}
