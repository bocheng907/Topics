import { db } from "@/firebase/firebaseConfig";
import { useEffect, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

export type ChartDataType = "體溫" | "心跳" | "血壓" | "血糖";
export type ChartTimeRange = "1周" | "2周" | "1個月" | "全部";

type UseHealthChartDataArgs = {
  patientId?: string;
  chartDataType: ChartDataType;
  chartTimeRange: ChartTimeRange;
};

type ChartPoint = {
  value: number;
  label?: string;
  dataPointText?: string;
};

type HealthRecordItem = {
  id: string;
  ts: number;
  temperature?: number;
  heartRate?: number;
  bloodPressureSys?: number;
  bloodPressureDia?: number;
  bloodSugar?: number;
  bloodSugarType?: string;
};

type HookState = {
  loading: boolean;
  empty: boolean;
  lineData: ChartPoint[];
  bpSysData: ChartPoint[];
  bpDiaData: ChartPoint[];
};

function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return 0;
}

function getRangeStart(range: ChartTimeRange): number | null {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  switch (range) {
    case "1周":
      return now - 7 * oneDay;
    case "2周":
      return now - 14 * oneDay;
    case "1個月":
      return now - 30 * oneDay;
    case "全部":
    default:
      return null;
  }
}

function formatLabel(ts: number, index: number, total: number): string {
  const d = new Date(ts);
  const month = d.getMonth() + 1;
  const day = d.getDate();

  if (total <= 7) {
    return `${month}/${day}`;
  }

  if (total <= 14) {
    return index % 2 === 0 ? `${month}/${day}` : "";
  }

  if (total <= 24) {
    return index % 3 === 0 ? `${month}/${day}` : "";
  }

  return index % 4 === 0 ? `${month}/${day}` : "";
}

function buildSingleLineData(
  records: HealthRecordItem[],
  valueKey: "temperature" | "heartRate" | "bloodSugar"
): ChartPoint[] {
  const valid = records.filter(
    (item) =>
      typeof item[valueKey] === "number" && !Number.isNaN(item[valueKey] as number)
  );

  return valid.map((item, index) => ({
    value: item[valueKey] as number,
    label: formatLabel(item.ts, index, valid.length),
    dataPointText: String(item[valueKey]),
  }));
}

function buildBloodPressureData(records: HealthRecordItem[]): {
  sys: ChartPoint[];
  dia: ChartPoint[];
} {
  const valid = records.filter(
    (item) =>
      typeof item.bloodPressureSys === "number" &&
      !Number.isNaN(item.bloodPressureSys) &&
      typeof item.bloodPressureDia === "number" &&
      !Number.isNaN(item.bloodPressureDia)
  );

  return {
    sys: valid.map((item, index) => ({
      value: item.bloodPressureSys as number,
      label: formatLabel(item.ts, index, valid.length),
      dataPointText: String(item.bloodPressureSys),
    })),
    dia: valid.map((item, index) => ({
      value: item.bloodPressureDia as number,
      label: formatLabel(item.ts, index, valid.length),
      dataPointText: String(item.bloodPressureDia),
    })),
  };
}

export function useHealthChartData({
  patientId,
  chartDataType,
  chartTimeRange,
}: UseHealthChartDataArgs): HookState {
  const [state, setState] = useState<HookState>({
    loading: true,
    empty: true,
    lineData: [],
    bpSysData: [],
    bpDiaData: [],
  });

  useEffect(() => {
    if (!patientId) {
      setState({
        loading: false,
        empty: true,
        lineData: [],
        bpSysData: [],
        bpDiaData: [],
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      loading: true,
    }));

    const q = query(
      collection(db, "health_records"),
      where("patientId", "==", patientId),
      orderBy("createdAt", "desc"),
      limit(300)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rangeStart = getRangeStart(chartTimeRange);

        const raw: HealthRecordItem[] = snap.docs.map((docSnap) => {
          const d = docSnap.data() as any;
          return {
            id: docSnap.id,
            ts: toMillis(d.createdAt),
            temperature:
              typeof d.temperature === "number" ? d.temperature : undefined,
            heartRate: typeof d.heartRate === "number" ? d.heartRate : undefined,
            bloodPressureSys:
              typeof d.bloodPressureSys === "number"
                ? d.bloodPressureSys
                : undefined,
            bloodPressureDia:
              typeof d.bloodPressureDia === "number"
                ? d.bloodPressureDia
                : undefined,
            bloodSugar:
              typeof d.bloodSugar === "number" ? d.bloodSugar : undefined,
            bloodSugarType:
              typeof d.bloodSugarType === "string" ? d.bloodSugarType : undefined,
          };
        });

        const inRange = raw
          .filter((item) => item.ts > 0)
          .filter((item) => (rangeStart ? item.ts >= rangeStart : true))
          // 關鍵修正：一定要改成「舊 -> 新」
          .sort((a, b) => a.ts - b.ts);

        let lineData: ChartPoint[] = [];
        let bpSysData: ChartPoint[] = [];
        let bpDiaData: ChartPoint[] = [];

        if (chartDataType === "體溫") {
          lineData = buildSingleLineData(inRange, "temperature");
        } else if (chartDataType === "心跳") {
          lineData = buildSingleLineData(inRange, "heartRate");
        } else if (chartDataType === "血糖") {
          lineData = buildSingleLineData(inRange, "bloodSugar");
        } else if (chartDataType === "血壓") {
          const bp = buildBloodPressureData(inRange);
          bpSysData = bp.sys;
          bpDiaData = bp.dia;
        }

        const empty =
          chartDataType === "血壓"
            ? bpSysData.length === 0 && bpDiaData.length === 0
            : lineData.length === 0;

        setState({
          loading: false,
          empty,
          lineData,
          bpSysData,
          bpDiaData,
        });
      },
      (error) => {
        console.log("useHealthChartData snapshot error:", error);
        setState({
          loading: false,
          empty: true,
          lineData: [],
          bpSysData: [],
          bpDiaData: [],
        });
      }
    );

    return unsub;
  }, [patientId, chartDataType, chartTimeRange]);

  return state;
}