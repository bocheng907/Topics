# RBAC and invitation implementation

Status: implementation in progress; not deployed.

The patient document ID (not patientsId) scopes access. Existing families and
caregivers arrays remain unchanged. Primary authority is primaryFamilyUid, or
the legacy createdBy only when that UID remains in families. An explicit empty
primaryFamilyUid disables fallback. No arbitrary family/caregiver is promoted.

Only the primary family may mutate prescriptions/items and medication schedules.
Linked members retain reads and medication/health recording. Invitation submission
consumes one code in a transaction but does not grant membership. Approval is
required. Regeneration revokes the previous invitation and pending application.

Current code analysis: patient queries use families/caregivers array-contains;
prescriptions use patientId, nested items inherit their parent; medication reminder
queries need patientId as well as prescriptionId. The OCR backend returns parsed
data, without Firestore writes. Translation-on-read must not persist prescriptions
for read-only members. Account deletion currently reassigns createdBy; primary
authority must not follow that reassignment.
