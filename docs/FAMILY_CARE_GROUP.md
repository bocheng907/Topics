# 家庭照護群組（整合版）

每位長者以 patientId 對應固定的聊天室，不需搬移舊訊息。

| 聊天空間 | 訊息集合 | 圖片目錄 | 可存取者 |
| --- | --- | --- | --- |
| 照護對話 | chats/{patientId}/messages | chats/{patientId}/images | 目前所屬家屬與照護員 |
| 家庭群組 | chats/{patientId}/familyMessages | chats/{patientId}/familyImages | 僅目前所屬家屬 |

家屬使用有效、24 小時內且未使用／撤銷的邀請碼直接加入；照護員仍須主要家屬核准。
授權依 patients.families／caregivers 判斷，機構角色不取得聊天室權限。
訊息只能由本人新增，不能由 App 修改或刪除；解除關聯後不能繼續讀取。

## 生命週期

- 個人匯出只包含本人發送且目前仍有權存取的訊息，排除媒體連結。
- 家庭群組匯出另驗證家屬身分，不能用照護員成員資格取代。
- 兩種聊天室均採六個月保存期限，清除各自目錄的過期圖片。
- 帳號到期刪除清除本人在兩個空間發送的訊息；不刪除其他成員訊息。
- 本次僅本機整合與模擬器驗證，需同步部署 Functions、Rules、索引後才可於正式環境使用。

Storage Rules 控制 SDK 存取；Firebase 下載連結含存取 token，不應轉傳給無權存取者。
