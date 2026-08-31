// src/health/useHealthThresholds.ts
import { db } from "@/firebase/firebaseConfig";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  getPatientDocumentCode,
  makeHealthThresholdDocumentId,
} from "@/src/data/firestoreDocumentIds";
import { useEffect, useState } from 'react';

// 定義每個數值的上下限型別
export type ThresholdRange = {
  min: string;     // 使用 string 方便 TextInput 綁定
  max: string;
  enabled: boolean;
};

// 血糖比較特別，分飯前飯後
export type BloodSugarRange = {
  beforeMin: string;
  beforeMax: string;
  afterMin: string;
  afterMax: string;
  enabled: boolean;
};

// 統整整個長輩的閾值設定結構
export type PatientThresholds = {
  temperature: ThresholdRange;
  heartRate: ThresholdRange;
  systolic: ThresholdRange;
  diastolic: ThresholdRange;
  bloodSugar: BloodSugarRange;
};

// 💡 系統預設的安全標準 (當家屬沒設定時的退路)
export const DEFAULT_THRESHOLDS: PatientThresholds = {
  temperature: { min: "36.0", max: "37.5", enabled: false },
  heartRate:   { min: "60", max: "100", enabled: false },
  systolic:    { min: "90", max: "140", enabled: false },
  diastolic:   { min: "60", max: "90", enabled: false },
  bloodSugar:  { beforeMin: "70", beforeMax: "130", afterMin: "70", afterMax: "180", enabled: false },
};

function mergeWithDefaults(data: Partial<PatientThresholds>): PatientThresholds {
  return {
    temperature: {...DEFAULT_THRESHOLDS.temperature, ...data.temperature},
    heartRate: {...DEFAULT_THRESHOLDS.heartRate, ...data.heartRate},
    systolic: {...DEFAULT_THRESHOLDS.systolic, ...data.systolic},
    diastolic: {...DEFAULT_THRESHOLDS.diastolic, ...data.diastolic},
    bloodSugar: {...DEFAULT_THRESHOLDS.bloodSugar, ...data.bloodSugar},
  };
}

export function useHealthThresholds(
  patientId: string,
  patientsId?: string | null
) {
  const [thresholds, setThresholds] = useState<PatientThresholds>(DEFAULT_THRESHOLDS);
  const [loading, setLoading] = useState(true);

  // 1. 監聽 Firestore 中的閾值設定
  useEffect(() => {
    if (!patientId) {
      setThresholds(DEFAULT_THRESHOLDS);
      setLoading(false);
      return;
    }

    const patientCode = getPatientDocumentCode({patientDocId: patientId, patientsId});
    const thresholdId = makeHealthThresholdDocumentId({patientDocId: patientId, patientsId});
    const docRef = doc(db, "health_thresholds", thresholdId);
    let active = true;
    
    const unsub = onSnapshot(docRef, async (docSnap) => {
      try {
        if (docSnap.exists()) {
          setThresholds(mergeWithDefaults(docSnap.data() as Partial<PatientThresholds>));
        } else {
          // 舊版以 patientId 為文件 ID；讀到後保留舊檔並建立可讀 ID 副本。
          const legacyRef = doc(db, "health_thresholds", patientId);
          const legacySnap = await getDoc(legacyRef);
          if (!active) return;

          if (legacySnap.exists()) {
            const legacyData = legacySnap.data() as Partial<PatientThresholds>;
            setThresholds(mergeWithDefaults(legacyData));
            await setDoc(docRef, {
              ...legacyData,
              thresholdId,
              patientDocId: patientId,
              patientsId: patientCode,
              migratedFrom: patientId,
              migratedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }, {merge: true});
          } else {
            setThresholds(DEFAULT_THRESHOLDS);
          }
        }
      } catch (error) {
        console.log("讀取或遷移舊閾值失敗:", error);
        if (active) setThresholds(DEFAULT_THRESHOLDS);
      } finally {
        if (active) setLoading(false);
      }
    }, (error) => {
      console.log("讀取閾值失敗:", error);
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      unsub();
    };
  }, [patientId, patientsId]);

  // 2. 提供給前端儲存設定的函數
  const saveThresholds = async (newThresholds: PatientThresholds) => {
    if (!patientId) return;
    try {
      const patientCode = getPatientDocumentCode({patientDocId: patientId, patientsId});
      const thresholdId = makeHealthThresholdDocumentId({patientDocId: patientId, patientsId});
      const docRef = doc(db, "health_thresholds", thresholdId);
      // 使用 setDoc 搭配 merge: true，確保寫入或覆蓋資料
      await setDoc(docRef, {
        ...newThresholds,
        thresholdId,
        patientDocId: patientId,
        patientsId: patientCode,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return true;
    } catch (error) {
      console.error("儲存閾值失敗:", error);
      throw error;
    }
  };

  return { thresholds, loading, saveThresholds };
}
