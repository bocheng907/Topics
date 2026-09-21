// UI feedback only; Firestore Rules enforce the deadline using server time.
export const INVITE_VALIDITY_MS = 24 * 60 * 60 * 1000;

export function isInviteActive(createdAt: unknown, now = Date.now()): boolean {
  if (!createdAt || typeof (createdAt as { toMillis?: unknown }).toMillis !== "function") return false;
  const issued = (createdAt as { toMillis(): number }).toMillis();
  return Number.isFinite(issued) && issued <= now && now < issued + INVITE_VALIDITY_MS;
}
