// src/store/prescriptions.ts
//
// ✅ 給組員解說用（重點請直接照念）
// 這支檔案是「Repository（資料存取層）」：
// - UI 不要直接操作 StoreProvider 的 prescriptions 陣列
// - UI 只透過這裡提供的函式 add/list/get
// - 未來換 Firebase：只改這支檔案內容，UI 幾乎不用動（無痛替換）
//
// ✅ 目前資料來源：StoreProvider（本地記憶體）
// 未來資料來源：Firestore + Storage（同樣維持 add/list/get 介面）

import type { Prescription, PrescriptionItem, TimeOfDay } from "./StoreProvider";
import { useStore } from "./useStore";

// ----------------------------
// 對齊你們共同規格的輸入格式
// （UI 送出時，傳這個就好）
// ----------------------------
export type AddPrescriptionInput = {
  careTargetId: string;               // ct_001
  sourceImageUrl?: string;            // 現在先存 imageUri；未來換 Storage URL
  status: "parsed" | "need_manual_fix";
  ocrRawText?: string;
  items: Array<{
    drug_name_zh: string;
    drug_name_translated?: string;
    dose: string;
    time_of_day: TimeOfDay[];
    note_zh?: string;
    note_translated?: string;
  }>;
};

// ----------------------------
// Repository APIs（UI 只能用這些）
// ----------------------------

/**
 * 新增藥單
 *
 * ✅ 給組員解說：
// - UI 呼叫 addPrescription()，不用知道資料存在哪
// - 現在存本地 StoreProvider；之後改存 Firebase 也不影響 UI
 */
export function usePrescriptionsRepo() {
  const { addPrescription, getPrescriptionsByCareTargetId, getPrescriptionById } = useStore();

  return {
    /**
     * 新增一筆藥單，回傳 prescriptionId（例如 p_1768...）
     */
    async create(input: AddPrescriptionInput): Promise<string> {
      // 轉成 StoreProvider 需要的型別（它會自己補 createdAt + prescriptionId）
      const items: PrescriptionItem[] = input.items.map((it, idx) => ({
        itemId: `it_${Date.now()}_${idx}`,
        drug_name_zh: it.drug_name_zh,
        drug_name_translated: it.drug_name_translated,
        dose: it.dose,
        time_of_day: it.time_of_day,
        note_zh: it.note_zh,
        note_translated: it.note_translated,
      }));

      const id = addPrescription({
        careTargetId: input.careTargetId,
        sourceImageUrl: input.sourceImageUrl,
        status: input.status,
        ocrRawText: input.ocrRawText,
        items,
      });

      return id;
    },

    /**
     * 依照 careTargetId 列出藥單（家屬 list 用）
     */
    async listByCareTargetId(careTargetId: string): Promise<Prescription[]> {
      // 先拿 store 的結果，再排序（新到舊）
      return getPrescriptionsByCareTargetId(careTargetId).sort((a, b) => b.createdAt - a.createdAt);
    },

    /**
     * 依照 id 取得單張藥單（家屬 detail 用）
     */
    async getById(id: string): Promise<Prescription | undefined> {
      return getPrescriptionById(id);
    },
  };
}
