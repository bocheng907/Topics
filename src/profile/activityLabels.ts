import { auditLogCopy, myDataExtraCopy } from "@/src/i18n/copy/accountCopy";
import type { Language } from "@/src/i18n/translations";
import { myDataCopy } from "./myDataCopy";

/** Present known audit operations as everyday language; never show unknown codes. */
export function activityOperationLabel(language: Language, value: string): string {
  const extra = myDataExtraCopy[language];
  const audit = auditLogCopy[language];
  if (Object.prototype.hasOwnProperty.call(extra.operations, value)) return extra.operations[value];
  if (Object.prototype.hasOwnProperty.call(audit.operations, value)) return audit.operations[value];
  return audit.unknownOperation;
}

export function activityResourceLabel(language: Language, resource: string | null): string {
  const t = myDataCopy[language];
  const labels: Record<string, string> = {
    prescriptions: t.prescriptions, prescription: t.prescriptions,
    prescription_items: t.prescriptions, patients: t.targets, patient: t.targets,
    users: t.profile, user: t.profile, health_records: t.health, health_thresholds: t.health,
    abnormal_records: t.abnormalities, care_notes: t.notes, calendar_events: t.calendars,
    notifications: t.notifications, messages: t.messages,
  };
  return resource && Object.prototype.hasOwnProperty.call(labels, resource) ? labels[resource] : "";
}
