// src/store/StoreProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type TimeOfDay = "morning" | "noon" | "afternoon" | "night";

export type PrescriptionItem = {
  itemId: string;
  drug_name_zh: string;
  drug_name_translated?: string;
  dose: string;
  time_of_day: TimeOfDay[];
  note_zh?: string;
  note_translated?: string;
};

export type Prescription = {
  prescriptionId: string;
  careTargetId: string; // 先固定 ct_001
  createdAt: number;
  sourceImageUrl?: string; // 目前先放本機 uri；未來換 Firebase Storage URL
  status: "parsed" | "need_manual_fix";
  ocrRawText?: string;
  items: PrescriptionItem[];
};

type StoreValue = {
  // UI 需要用到的資料
  prescriptions: Prescription[];

  // UI 呼叫的動作（未來換 Firebase：把內部實作換掉，UI 不用改）
  addPrescription: (input: Omit<Prescription, "prescriptionId" | "createdAt">) => string;
  getPrescriptionsByCareTargetId: (careTargetId: string) => Prescription[];
  getPrescriptionById: (id: string) => Prescription | undefined;
  removePrescription: (id: string) => void;
  
  // ✅ 你後來有用到：把圖片路徑更新進 store（家屬端 detail 才能顯示）
  updatePrescriptionImage: (prescriptionId: string, sourceImageUrl: string) => void;

  // 測試用（可留可不留）
  resetStore: () => void;

  // 讓畫面知道 store 是否已經「從本機讀完」
  ready: boolean;
};

const StoreContext = createContext<StoreValue | null>(null);

// 本地持久化 key（之後改 Firebase 也不用改 UI，只改這裡）
const STORAGE_KEY = "careapp_store_v1";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [ready, setReady] = useState(false);

  // 1) 啟動時：從本機讀回來
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { prescriptions?: Prescription[] };
          setPrescriptions(parsed.prescriptions ?? []);
        }
      } catch (e) {
        console.warn("hydrate store failed:", e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // 2) prescriptions 變動：自動寫回本機（避免 ready 前把空值寫回去覆蓋）
  useEffect(() => {
    if (!ready) return;

    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ prescriptions }));
      } catch (e) {
        console.warn("persist store failed:", e);
      }
    })();
  }, [prescriptions, ready]);

  const value = useMemo<StoreValue>(() => {
    function addPrescription(input: Omit<Prescription, "prescriptionId" | "createdAt">) {
      const base = Date.now();
      const prescriptionId = `p_${base}`;

      const itemsWithId: PrescriptionItem[] = input.items.map((it, idx) => ({
        ...it,
        itemId: it.itemId && it.itemId.trim() !== "" ? it.itemId : `it_${base}_${idx}`,
      }));

      const record: Prescription = {
        prescriptionId,
        careTargetId: input.careTargetId,
        createdAt: base,
        sourceImageUrl: input.sourceImageUrl,
        status: input.status,
        ocrRawText: input.ocrRawText,
        items: itemsWithId,
      };

      setPrescriptions((prev) => [record, ...prev]);
      return prescriptionId;
    }

    function getPrescriptionsByCareTargetId(careTargetId: string) {
      return prescriptions.filter((p) => p.careTargetId === careTargetId);
    }

    function getPrescriptionById(id: string) {
      return prescriptions.find((p) => p.prescriptionId === id);
    }

    function updatePrescriptionImage(prescriptionId: string, sourceImageUrl: string) {
      setPrescriptions((prev) =>
        prev.map((p) => (p.prescriptionId === prescriptionId ? { ...p, sourceImageUrl } : p))
      );
    }

    function resetStore() {
      setPrescriptions([]);
    }

    function removePrescription(id: string) {
      setPrescriptions((prev) => prev.filter((p) => p.prescriptionId !== id));
    }

    return {
      prescriptions,
      addPrescription,
      getPrescriptionsByCareTargetId,
      getPrescriptionById,
      updatePrescriptionImage,
      resetStore,
      removePrescription,
      ready,
    };
  }, [prescriptions, ready]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStoreContext() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
