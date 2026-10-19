# 社群分支整合驗證（2026-10-19）

整合來源：`9cb3220ab6bd94b132c305e9820f2db5271c8aaa`。
原始 HEAD：`88fc42d3633592b9aa8cc8673ef9bbc453190ab0`。
新分支：`codex/community-integration-20261019`。
本文件描述程式整合與本機測試，不是正式部署或 iPhone 實測證明。

## 本次重新驗證

| 檢查 | 結果 |
| --- | --- |
| Firestore / Storage / 社群角色、隱藏文章、留言計數 | 66/66 |
| 邀請、藥單、機構、個資匯出、社群刪除整合 | 78/78 |
| 離線重試、交接版本、健康紀錄去重、刪除期限 | 58/58 |
| Functions 單元測試 | 50/50 |
| 前端純邏輯回歸 | 66/66 |
| 新增本機媒體讀檔單元測試 | 8/8 |
| 照護員解除本人關聯／保留共用資料 | 22/22 |
| 保存期限實際清除（隔離 Firestore + Storage） | 1/1 |
| Playwright 合成多語系 / 窄螢幕 / 大字級版面 | 24/24 |
| 前端 ESLint（零警告）與 TypeScript | 通過 |
| Functions ESLint、Expo 依賴檢查 | 通過 |
| Expo Web / iOS / Android export | 通過，Web 70 路由 |

合計 449 項測試與 24 組合成版面案例。保留舊版歷史測試腳本不代表
所有歷史／一次性驗收腳本都已重跑，以上列出的是這次確實執行的套件。

詳細輸出在 `output/community-final-*.log`、
`output/community-full-regression-20261019-r3.log` 與
`output/playwright/layout-audit/results.json`，刻意不提交輸出與帳號資料。
Emulator 結束時 Windows Java 程序可能未退出，Storage runtime 也有關閉階段
NullPointerException；測試本身已回傳 0。這不代表正式環境已驗證。

## 已核對的整合範圍

- 上游 113 個檔案路徑由 `scripts/verify-community-integration.cjs` 核對。
  舊歷史說明、未使用原型與被 callable 取代的角色遷移腳本明確列為排除。
- Expo 57、社群頁面／角色映射、個人資料、機構綁定及服務摘要已整合。
- 保留照護員掃描、成員編修藥單、家屬專用聊天、UUID、交接確認與響應式版面。
- 社群匯出包含本人可存取文字，不含他人留言與媒體；到期刪除移除本人內容／圖片，
  留下匿名文章框架及他人留言，已測試重試安全性。
- Rules 相容修正附正反案例，未開放跨長者資料或任意角色映射寫入。
- 本機媒體共用 `readLocalBlob`，不再依賴未提交的 RN fetch 環境旗標。

## 重跑方式

前端：`npx eslint app src firebase components hooks --max-warnings 0`、
`npx tsc --noEmit`、`node --test scripts/local-media.test.cjs`。
後端：`npm --prefix functions test`。

所有 Emulator 命令使用 `demo-*`，不對正式專案執行：

```powershell
npx firebase-tools@15.34.0 emulators:exec --project demo-rules-test --config firebase.community-test.json --only firestore,storage "node --test --test-concurrency=1 tests/rules/*.test.mjs"
npx firebase-tools@15.34.0 emulators:exec --project demo-invite-expiry --config firebase.agency-test.json --only firestore "node --test --test-concurrency=1 scripts/agency-integration.test.cjs scripts/community-lifecycle.test.cjs scripts/personal-data-export.test.cjs scripts/extended-flows.test.cjs scripts/invite-expiry.test.cjs scripts/care-target-access.test.cjs scripts/prescription-creation.test.cjs"
npx firebase-tools@15.34.0 emulators:exec --project demo-care-walkthrough --config firebase.walkthrough.json --only firestore,auth "node --test scripts/reliability.test.cjs"
npx firebase-tools@15.34.0 emulators:exec --project demo-invite-expiry --config firebase.retention-test.json --only firestore,storage "node --test functions/retention.emulator.cjs"
npx firebase-tools@15.34.0 emulators:exec --project demo-handbook-release --config firebase.leave-test.json --only firestore "node --test scripts/care-leave.test.cjs"
```

## 發布與實機驗收仍分開處理

- 此次未部署 Firebase。新版用戶端依賴 `syncCommunityRole` 等後端與 Rules，
  正式發版必須先驗證配套後端、索引、Rules，再發布前端，不能只更新 App。
- 未重新驗證正式憑證，也未操作正式清除排程或刪除正式資料。
- iPhone Expo Go 相機、錄音／錄影、播放、分享、推播須實機操作；
  三平台 bundle、XHR mock 與合成版面測試不能取代實機驗收。
- 隱藏文章的 Storage SDK 存取已受控；以前分享出去的下載 token URL
  不會因 Rules 自動失效，不能宣稱媒體已全面撤回。
- HTTP OCR 按使用者既有決策保留，不宣稱全站 HTTPS。

## 限定範圍權限審查（非整個專案安全認證）

```json
{"score":3,"summary":"Integrated Rules and lifecycle emulator regressions pass; rollout and distributed media URL revocation remain separate boundaries.","findings":[{"check":"Business Logic vs. Rules","severity":"major","issue":"New client depends on coordinated backend deployment; this pass does not deploy.","recommendation":"Verify backend-first rollout before production release."},{"check":"Authority Source","severity":"moderate","issue":"Previously shared download-token URLs are not revoked by hiding a post.","recommendation":"Use authenticated delivery or explicit token revocation if confidentiality after sharing is required."}]}
```
