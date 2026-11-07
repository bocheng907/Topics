import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/firebaseConfig";

export const createCareTarget = httpsCallable<
  { name: string; notes: string; requestId: string },
  { patientId: string; inviteCode: string }
>(functions, "createCareTarget");

export const joinCareTarget = httpsCallable<
  { code: string },
  { patientId: string; alreadyJoined: boolean; status: string }
>(functions, "joinCareTarget");

export const leaveCareTarget = httpsCallable<
  { patientId: string },
  { patientId: string; alreadyLeft: boolean }
>(functions, "leaveCareTarget");

export type InvitationState = { code: string; status: string; expiresAt: number;
  requestId: string; role: string; applicantUid: string;
  secondaryFamilyUids: string[];
  // 新版後端才有；舊版部署時為 undefined
  applicant?: InvitationMemberIdentity;
  secondaryFamilyProfiles?: (InvitationMemberIdentity & { uid: string })[] };
export type InvitationMemberIdentity = { displayName: string; avatarUrl: string; role: string };
export const manageInvitation = httpsCallable<
  { patientId: string; action: "get" | "regenerate" | "revoke" | "approve" |
    "reject" | "transfer"; requestId?: string; targetUid?: string },
  InvitationState
>(functions, "manageInvitation");
