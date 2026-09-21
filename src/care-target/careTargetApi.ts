import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/firebaseConfig";

export const createCareTarget = httpsCallable<
  { name: string; notes: string },
  { patientId: string; inviteCode: string }
>(functions, "createCareTarget");

export const joinCareTarget = httpsCallable<
  { code: string },
  { patientId: string; alreadyJoined: boolean; status: string }
>(functions, "joinCareTarget");

export type InvitationState = { code: string; status: string; expiresAt: number; requestId: string; role: string; applicantUid: string };
export const manageInvitation = httpsCallable<
  { patientId: string; action: "get" | "regenerate" | "revoke" | "approve" | "reject"; requestId?: string },
  InvitationState
>(functions, "manageInvitation");
