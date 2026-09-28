import { functions } from "@/firebase/firebaseConfig";
import { httpsCallable } from "firebase/functions";

import type {
  AgencyReportCategory,
} from "./agencyReportTypes";

export const getAgencyReportContext = httpsCallable<
  {
    patientId: string;
  },
  {
    patientId: string;
    patientName: string;
    caregivers: {
      caregiverUid: string;
      caregiverName: string;
    }[];
  }
>(
  functions,
  "getAgencyReportContext"
);

export const createAgencyReport = httpsCallable<
  {
    patientId: string;
    caregiverUid: string;
    category: AgencyReportCategory;
    title: string;
    description: string;
  },
  {
    reportId: string;
    status: "open";
  }
>(
  functions,
  "createAgencyReport"
);