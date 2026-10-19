import { functions } from "@/firebase/firebaseConfig";
import { httpsCallable } from "firebase/functions";
import type { Role } from "./AuthProvider";

/** The server verifies ownership and uniqueness, including legacy profiles. */
export async function syncUserRole(uid: string, role: Role, userDocId: string): Promise<void> {
  if (!uid || !userDocId) throw new Error("Missing account profile.");
  const result = await httpsCallable<Record<string, never>, {role: Role; userDocId: string}>(
    functions, "syncCommunityRole"
  )({});
  if (result.data.role !== role || result.data.userDocId !== userDocId) {
    throw Object.assign(new Error("Account role mapping requires review."), {
      code: "profile/role-mismatch",
    });
  }
}
