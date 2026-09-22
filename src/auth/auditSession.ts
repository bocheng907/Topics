import { signOut as firebaseSignOut, type Auth } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/firebaseConfig";

export async function reportSession(operation: "login" | "logout_requested") {
  try {
    await httpsCallable(functions, "recordSessionAudit", { timeout: 5000 })({ operation });
  } catch {
    // Audit outages must not lock the user out or prevent signing out.
    console.warn("Session audit delivery failed");
  }
}

export async function signOut(auth: Auth) {
  if (auth.currentUser) await reportSession("logout_requested");
  await firebaseSignOut(auth);
}
