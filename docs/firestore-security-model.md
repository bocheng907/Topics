# Firestore access model (2026-09-22)

This file records the data/query assumptions used by the Rules and emulator
tests. Collection names are not document IDs: patient membership is anchored by
the Firestore document ID under `patients/{patientId}`.

## Roles

- A primary family UID is `primaryFamilyUid`; legacy fallback to `createdBy`
  applies only when the field is absent, never when it is explicitly empty.
- Secondary families are UIDs in `families` other than the primary UID and not
  also present in `caregivers`.
- Caregivers are UIDs in `caregivers`.
- Client code cannot edit membership arrays or the primary UID. Trusted callable
  transactions approve joins and transfer primary ownership.

## Read/write boundaries

- Users read and update only their unique own profile. Identity, role, policy
  consent and deletion fields are immutable to the client.
- Linked members may read the patient-scoped collections used by the app.
- Primary family controls patient profile settings, health thresholds and edits
  or deletes existing prescriptions and reminders.
- Caregivers may atomically create a prescription, its items and reminders, and
  may create/update their own health records. They cannot later edit a
  prescription.
- Secondary family members cannot mutate patient settings, thresholds or
  prescriptions.
- Audit logs are server-owned; only the `auditAdmin` custom claim can read all
  logs. My Data summaries are returned by an authenticated callable with an
  allowlisted response.

## Query and index assumptions

- Patient lists query `families array-contains uid` or
  `caregivers array-contains uid`.
- Patient-scoped records query an exact `patientId`; blanket collection scans
  are denied by Rules.
- My Data uses Admin SDK owner-field queries and rechecks patient membership.
- Recent activity queries `audit_logs(actorId, occurredAt desc)`; the composite
  index is declared in `firestore.indexes.json`.

## Limits and recovery

Membership arrays and user input strings are bounded. An explicitly empty
primary UID is fail-closed and requires trusted administrative recovery; a
member cannot claim it through a client write.
