import { db } from "@/firebase/firebaseConfig";
import { useAuth } from "@/src/auth/useAuth";

import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  AgencyReport,
  AgencyReportLevel,
  AgencyReportStatus,
} from "./agencyReportTypes";

type UpdateReportInput = {
  level: AgencyReportLevel;
  status: AgencyReportStatus;
  handlingNote: string;
};

function timestampToMillis(value: any) {
  if (!value) return 0;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  return 0;
}

export function useAgencyReports() {
  const { user } = useAuth();

  const [reports, setReports] = useState<AgencyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const accountScope = `${user?.uid}/${user?.role}`;
  const [previousScope, setPreviousScope] = useState<string | null>(null);
  if (previousScope !== accountScope) {
    setPreviousScope(accountScope); setReports([]); setError("");
    setLoading(user?.role === "agency");
  }

  useEffect(() => {
    if (!user || user.role !== "agency") {
      return;
    }


    const agencyUid = user.uid;
    let generation = 0;
    let stops: (() => void)[] = [];
    const stopMembers = onSnapshot(query(collection(db, "agency_memberships"),
      where("agencyUid", "==", agencyUid)), members => {
      const epoch = ++generation;
      stops.forEach(stop => stop());
      stops = [];
      setReports([]);
      const rows = new Map<string, AgencyReport[]>();
      const pending = new Set(members.docs.map(member => member.id));
      setLoading(pending.size > 0);
      for (const member of members.docs) {
        stops.push(onSnapshot(query(collection(db, "agency_reports"),
          where("agencyUid", "==", agencyUid), where("caregiverUid", "==", member.id)),
        snapshot => {
          if (epoch !== generation) return;
          rows.set(member.id, snapshot.docs.map(item => ({...item.data(), id: item.id} as AgencyReport)));
          pending.delete(member.id);
          setReports([...rows.values()].flat().sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt)));
          setLoading(pending.size > 0);
        }, () => {
          if (epoch !== generation) return;
          pending.delete(member.id);
          rows.delete(member.id);
          setReports([...rows.values()].flat());
          setError("回報資料載入失敗");
          setLoading(pending.size > 0);
        }));
      }
    }, () => {
      generation++;
      stops.forEach(stop => stop());
      setReports([]); setLoading(false); setError("回報資料載入失敗");
    });
    return () => { generation++; stopMembers(); stops.forEach(stop => stop()); };
  }, [user]);

  const openReports = useMemo(
    () =>
      reports.filter(
        (report) => report.status === "open"
      ),
    [reports]
  );

  const pendingReports = useMemo(
    () =>
      reports.filter(
        (report) =>
          report.status === "open" &&
          report.level === "pending"
      ),
    [reports]
  );

  const attentionReports = useMemo(
    () =>
      reports.filter(
        (report) =>
          report.status === "open" &&
          report.level === "attention"
      ),
    [reports]
  );

  const normalReports = useMemo(
    () =>
      reports.filter(
        (report) =>
          report.status === "open" &&
          report.level === "normal"
      ),
    [reports]
  );

  const resolvedReports = useMemo(
    () =>
      reports.filter(
        (report) => report.status === "resolved"
      ),
    [reports]
  );

  const recentReports = useMemo(
    () => reports.slice(0, 3),
    [reports]
  );

  async function updateReport(
    reportId: string,
    input: UpdateReportInput
  ) {
    if (!user || user.role !== "agency") {
      throw new Error(
        "Only agency accounts can update reports."
      );
    }

    const reportRef = doc(
      db,
      "agency_reports",
      reportId
    );

    await updateDoc(reportRef, {
      level: input.level,
      status: input.status,
      handlingNote: input.handlingNote.trim(),

      updatedAt: serverTimestamp(),

      handledAt:
        input.status === "resolved"
          ? serverTimestamp()
          : null,

      handledBy:
        input.status === "resolved"
          ? user.uid
          : "",
    });
  }

  return {
    reports,

    openReports,
    pendingReports,
    attentionReports,
    normalReports,
    resolvedReports,

    recentReports,

    pendingCount: pendingReports.length,
    attentionCount: attentionReports.length,
    openCount: openReports.length,
    resolvedCount: resolvedReports.length,

    loading,
    error,

    updateReport,
  };
}
