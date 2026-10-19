export type ProfileRole = "caregiver" | "family" | "agency";

export type ProfileState =
  | { kind: "missing" }
  | { kind: "duplicate" }
  | { kind: "invalid" }
  | { kind: "ready"; role: ProfileRole; data: Record<string, unknown> };

/** Refuses ambiguous or malformed profiles instead of inventing a role. */
export function classifyProfiles(
  profiles: readonly Record<string, unknown>[],
  expectedUid: string,
): ProfileState {
  if (profiles.length === 0) return { kind: "missing" };
  if (profiles.length !== 1) return { kind: "duplicate" };
  const data = profiles[0];
  if (data.uid !== expectedUid || (data.role !== "caregiver" && data.role !== "family" && data.role !== "agency")) {
    return { kind: "invalid" };
  }
  return { kind: "ready", role: data.role, data };
}

export function profileStateError(state: Exclude<ProfileState, { kind: "ready" | "missing" }>) {
  const duplicate = state.kind === "duplicate";
  return Object.assign(new Error(duplicate ?
    "Duplicate account profiles require administrator review." :
    "The account profile is incomplete or invalid."), {
    code: duplicate ? "profile/duplicate" : "profile/invalid",
  });
}
