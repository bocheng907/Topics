import type { Timestamp } from "firebase/firestore";

export type AgencyReportLevel =
  | "normal"
  | "attention"
  | "pending";

export type AgencyReportStatus =
  | "open"
  | "resolved";

export type AgencyReport = {
  id: string;

  agencyUid: string;

  caregiverUid: string;
  caregiverName: string;

  patientId: string;
  patientName: string;

  reporterUid: string;
  reporterRole: "family" | "caregiver";
  reporterName: string;

  title: string;
  description: string;

  level: AgencyReportLevel;
  status: AgencyReportStatus;

  handlingNote: string;

  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;

  handledAt: Timestamp | null;
  handledBy: string;
};