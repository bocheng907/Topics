import { functions } from "@/firebase/firebaseConfig";
import { httpsCallable } from "firebase/functions";


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