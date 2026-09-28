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

  useEffect(() => {
    if (!user || user.role !== "agency") {
      setReports([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    const reportsQuery = query(
      collection(db, "agency_reports"),
      where("agencyUid", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      reportsQuery,
      (snapshot) => {
        const nextReports = snapshot.docs
          .map((reportDoc) => {
            const data = reportDoc.data();

            return {
              id: reportDoc.id,
              ...data,
            } as AgencyReport;
          })
          .sort(
            (a, b) =>
              timestampToMillis(b.createdAt) -
              timestampToMillis(a.createdAt)
          );

        setReports(nextReports);
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        console.log(
          "[agency reports] load failed:",
          snapshotError
        );

        setReports([]);
        setLoading(false);
        setError("回報資料載入失敗");
      }
    );

    return unsubscribe;
  }, [user?.uid, user?.role]);

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