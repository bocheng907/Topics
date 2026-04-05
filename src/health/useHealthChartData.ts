import { db } from "@/firebase/firebaseConfig";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";

export type ChartDataType = "體溫" | "心跳" | "血壓" | "血糖";
export type ChartTimeRange = "1周" | "2周" | "1個月" | "全部";

type ChartPoint = {
  value: number;
  label: string;
};

function getCutoffTime(range: ChartTimeRange) {
  const now = Date.now();

  if (range === "1周") return now - 7 * 24 * 60 * 60 * 1000;
  if (range === "2周") return now - 14 * 24 * 60 * 60 * 1000;
  if (range === "1個月") return now - 30 * 24 * 60 * 60 * 1000;

  return 0;
}

export function useHealthChartData({
  patientId,
  chartDataType,
  chartTimeRange,
}: {
  patientId?: string | null;
  chartDataType: ChartDataType;
  chartTimeRange: ChartTimeRange;
}) {
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  const [lineData, setLineData] = useState<ChartPoint[]>([]);
  const [bpSysData, setBpSysData] = useState<ChartPoint[]>([]);
  const [bpDiaData, setBpDiaData] = useState<ChartPoint[]>([]);

  useEffect(() => {
    if (!patientId) {
      setLineData([]);
      setBpSysData([]);
      setBpDiaData([]);
      setEmpty(true);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, "health_records"),
      where("patientId", "==", patientId),
     orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const raw = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          ...data,
          ts: data.createdAt?.toMillis?.() ?? 0,
        };
      });

      const cutoff = getCutoffTime(chartTimeRange);
      const arr = raw.filter((item) => item.ts && item.ts >= cutoff);

      if (arr.length === 0) {
        setLineData([]);
        setBpSysData([]);
        setBpDiaData([]);
        setEmpty(true);
        setLoading(false);
        return;
      }

      setEmpty(false);

      if (chartDataType === "體溫") {
        const next = arr
          .filter((d) => d.temperature !== undefined)
          .map((d) => ({
            value: Number(d.temperature),
            label: `${new Date(d.ts).getMonth() + 1}/${new Date(d.ts).getDate()}`,
          }));

        setLineData(next);
        setBpSysData([]);
        setBpDiaData([]);
        setEmpty(next.length === 0);
      }

      if (chartDataType === "心跳") {
        const next = arr
          .filter((d) => d.heartRate !== undefined)
          .map((d) => ({
            value: Number(d.heartRate),
            label: `${new Date(d.ts).getMonth() + 1}/${new Date(d.ts).getDate()}`,
          }));

        setLineData(next);
        setBpSysData([]);
        setBpDiaData([]);
        setEmpty(next.length === 0);
      }

      if (chartDataType === "血糖") {
        const next = arr
          .filter((d) => d.bloodSugar !== undefined)
          .map((d) => ({
            value: Number(d.bloodSugar),
            label: `${new Date(d.ts).getMonth() + 1}/${new Date(d.ts).getDate()}`,
          }));

        setLineData(next);
        setBpSysData([]);
        setBpDiaData([]);
        setEmpty(next.length === 0);
      }

      if (chartDataType === "血壓") {
        const sys = arr
          .filter((d) => d.bloodPressureSys !== undefined)
          .map((d) => ({
            value: Number(d.bloodPressureSys),
            label: `${new Date(d.ts).getMonth() + 1}/${new Date(d.ts).getDate()}`,
          }));

        const dia = arr
          .filter((d) => d.bloodPressureDia !== undefined)
          .map((d) => ({
            value: Number(d.bloodPressureDia),
            label: `${new Date(d.ts).getMonth() + 1}/${new Date(d.ts).getDate()}`,
          }));

        setLineData([]);
        setBpSysData(sys);
        setBpDiaData(dia);
        setEmpty(sys.length === 0 && dia.length === 0);
      }

      setLoading(false);
    });

    return unsub;
  }, [patientId, chartDataType, chartTimeRange]);

  return {
    loading,
    empty,
    lineData,
    bpSysData,
    bpDiaData,
  };
}