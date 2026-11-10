import type { SnapshotStatus } from "@/src/data/useScopedSnapshot";

/** Only report an empty reminder list, or allow DONE, after server confirmation. */
export function reminderLoadState(reminders: SnapshotStatus, logs: SnapshotStatus, hasReminder: boolean) {
  const states = [reminders, logs];
  const feedback: SnapshotStatus = states.includes("error") ? "error"
    : states.includes("loading") ? "loading"
    : states.includes("cached") ? "cached"
    : states.includes("idle") ? "idle" : "ready";
  return {
    feedback,
    showReminder: hasReminder || reminders === "ready",
    canConfirm: reminders === "ready" && logs === "ready",
  };
}
