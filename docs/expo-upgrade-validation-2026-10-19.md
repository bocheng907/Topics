# Expo 升級錯誤修正與本機驗證

日期：2026-10-19。範圍：Expo 升級後回報的 86 個 lint 錯誤、35 個警告；不是整個合併／正式發布的完成宣告。

## 結果

| 檢查 | 本次結果 |
| --- | --- |
| `npm run lint -- --no-cache` | 通過 |
| `npx eslint app src firebase components hooks --max-warnings 0` | 0 錯誤、0 警告 |
| `npx tsc --noEmit` | 通過 |
| `npx expo install --check` | Dependencies are up to date |
| 本機程式回歸 | 66/66 通過 |
| Playwright 合成版面回歸 | 24/24 通過 |
| Web、iOS、Android export | 全部通過；Web 70 個靜態路由 |
| `git diff --check` | 使用原有 Windows 換行設定通過 |

## 主要修正

- 把依帳號、長者、日期或來源資料改變的表單／列表重設，改為有條件的狀態重設或直接衍生資料，避免 effect 內同步連鎖更新。
- 避免在 render 讀寫 ref；動畫實例改為穩定初始化，畫面上的完成／載入旗標改用 state。
- 修正邀請管理按鈕、刷新生命週期、轉移成功提示與舊請求回應的範圍檢查。
- 音訊結束由 `playbackStatusUpdate` 事件更新；試聽進度使用播放器實際時間，不再用另一個計時器猜測。
- 健康資料過期判斷使用定時更新的時間 state；沒有日期的影像資料不再於 render 偽填現在時間。
- 異常紀錄資料夾項目 ID 使用 UUID，避免毫秒 ID 重複。
- 保留原生 Firebase Auth 的 AsyncStorage persistence，以及 Web／重新初始化時的 getAuth 路徑。
- 穩定長者切換 callback；補上機構列表非同步回應的取消／版本檢查。
- 移除未使用匯入與變數、補正 hook dependencies。未新增 lint-disable，也未調降 lint 規則。

## 重跑方式

```powershell
npm run lint -- --no-cache
npx tsc --noEmit
npx expo install --check
node --test scripts/firebase-config.test.cjs scripts/medication-progress.test.cjs scripts/export-file.test.cjs scripts/export-diagnostic.test.cjs scripts/password-policy.test.cjs scripts/upload-filename.test.cjs scripts/rbac-flow-ui.test.cjs tests/firestoreDocumentIds.test.mjs
npx expo export --platform all --output-dir output/expo-lint-fix-final-20261019
```

版面使用既有 `scripts/layout-regression.cjs`，透過 `PLAYWRIGHT_MODULE` 指向本機可用的 Playwright。
測試組合為中／英／越／印尼語 × 320／393／768 寬度 × 1／1.5 模擬字級。
這是使用來源樣式的合成 fixture，不是登入後全頁 E2E；已目視檢查英語 393 寬度截圖。

輸出：

- `output/expo-lint-fix-final-20261019/`：本機三平台 bundle，非安裝包。
- `output/playwright/layout-audit/results.json`：版面回歸結果。
- `output/playwright/layout-audit/en-393-1.png`：目視檢查截圖。

## 驗收邊界

- 本次未部署 Firebase、未上架、未推送或提交 Git；保留原有未提交的整合變更。
- 本次測試未建立、修改或刪除正式帳號／照護資料。
- iOS／Android export 證明 JavaScript bundle 可產生，不等於原生安裝包或實機驗收。
- iPhone Expo Go 的相機權限、錄音／錄影、播放、推播及手機分享仍需實機測試。
- 工具輸出仍可能包含 `NO_COLOR`／`FORCE_COLOR`、Web push listener 不支援、React Native Web shadow 樣式棄用等提示；這些不是上述已歸零的 ESLint 診斷，也不代表原生推播送達已驗證。
- 社群後端、Rules、生命週期與完整合併／部署驗收屬另一個範圍，不能由這份前端修正報告推定全部完成。
