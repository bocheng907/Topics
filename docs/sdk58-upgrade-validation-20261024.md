# Expo SDK 58 升級與驗證（2026-10-24）

## 變更範圍

- Expo 58.0.19、React Native 0.88.0、React / React DOM 19.3.0，相關 Expo 模組依官方版本對齊。
- 更新 ScrollView instance refs、圖示顏色型別、ListEmptyComponent、通知重要性匯入。
- 移除已不支援的 InteractionManager 與 StatusBar backgroundColor 用法。
- 建立長者頁改用反應式 useCanGoBack，避免首次渲染前呼叫 imperative router。
- 音訊頁與登入後導覽樹延後至瀏覽器掛載；原生 App 不延遲首次渲染。
- Web 關閉 async routes，改為 single-page application。SDK 58 開發模式靜態渲染仍重現 unknown module 錯誤，因此不再使用該渲染路徑。
- public/index.html 保留 React Native Web 根容器樣式，並以 CSS env 處理瀏海／底部安全區域。
- 限定覆寫 @grpc/grpc-js 1.14.6、@expo/ngrok 的 uuid 11.1.1，補上 API 相容性回歸。

## 已完成檢查

- TypeScript `npx tsc --noEmit`：通過。
- `npm run lint`：通過。
- `npx expo install --check`：套件版本一致。
- `npx expo-doctor@latest`：20/20 通過。
- 選定前端回歸及 SDK 相容性測試：120/120 通過。
- `expo export --platform all`：最終 SPA 版本的 iOS／Android Hermes bundle 與 Web 匯出成功。
- 正式模式（127.0.0.1:8083）：家屬、照護員、仲介登入及下列 10 個頁面通過；沒有 pageerror、白屏、Server Error、hydration 錯誤或 390px 水平溢出。
- 開發模式（localhost:8081）：相同三種角色與 10 個頁面全部通過，原本 unknown module 的首輪路由載入錯誤未再重現。
- 頁面：家屬首頁、家屬語音、家屬行事曆、新增長者、家屬聊天清單、照護員首頁、溝通語音圖卡、照護員行事曆、仲介首頁、仲介趨勢。
- 已檢視語音、長者建立、照護員語音圖卡及仲介首頁截圖。這是選定路由 smoke test，不等於所有頁面所有按鈕或手機影音完整驗收。
- 開發服務 manifest：sdkVersion=58.0.0，runtimeVersion=exposdk:58.0.0。

## 安全與驗收邊界

- 根目錄 npm audit 從 12 項（2 moderate、10 high）降至 5 項 high；不代表整個專案已無漏洞。
- 剩餘 5 項套件警告源於 Expo CLI 的 node-forge 與 Zod，並向上影響 Expo CLI／憑證套件／Expo。2026-10-24 查到 node-forge 最新 1.4.0 仍在公告受影響範圍；Zod 3 最新 3.25.76 仍被掃描列出。未強制跨主版本替換 CLI 的 schema 依賴，也未依 npm 建議把 Expo 降回 54。
- 公告：<https://github.com/advisories/GHSA-86w9-cpqp-85rv>、<https://github.com/advisories/GHSA-mrhx-c7xc-m3w5>。
- 此輪未部署 Firebase Functions、Rules、Hosting，未修改 OCR HTTP 決策。
- 既有 Hosting 仍只提供隱私政策，不受 App Web single-page 設定影響。未來部署 App 網頁需把應用程式路由 rewrite 到 index.html，不能直接拿隱私政策網站設定發布。
- JavaScript／Hermes 匯出不是原生 APK／IPA 編譯。iPhone Expo Go SDK 58 的錄音、錄影、播放、分享、推播仍需實機驗收。
- Git 推送不會自動更新已安裝的原生 App。Expo Go 需相容 SDK 58；development build／正式安裝包需重建。

## 本機證據

- `output/sdk58-regression.log`：120 項回歸結果。
- `output/sdk58-export-final.log`：最終三平台匯出。
- `output/sdk58-browser-static.log`：正式模式瀏覽器驗收（名稱沿用測試腳本；最終產物為 SPA）。
- `output/sdk58-browser-dev.log`：開發模式驗收。
- `output/playwright/sdk58-*.png`：390 × 844 瀏覽器截圖。

上述 output 檔案及展示帳號憑證不納入 Git 提交。
