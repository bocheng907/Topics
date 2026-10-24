/** Never use a persisted session as proof of the credentials entered now. */
export async function registrationAccount<T>(
  create: () => Promise<T>,
  signIn: () => Promise<T>,
): Promise<T> {
  try {
    return await create();
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) ||
        error.code !== "auth/email-already-in-use") throw error;
    // Auth may have succeeded before a previous profile write failed. A fresh
    // sign-in verifies ownership even after an app restart. The caller must
    // still reject existing profiles, never overwrite their role or consent.
    return await signIn();
  }
}

export function normalizeRegistrationEmail(email: string): string {
  return email.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}
