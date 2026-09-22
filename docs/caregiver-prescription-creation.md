# Caregiver prescription creation

Scope: approved per-patient caregivers can scan and directly create prescriptions.
Secondary families remain read-only; primary family retains edit/delete authority.
No data migration, member changes, or production deployment is included.

The existing Standard Firestore rules model is retained. Live edition recheck on
2026-09-21 was blocked by expired Firebase CLI authentication.

Paths: prescriptions/{id}, prescriptions/{id}/items/{item}, medication_reminders/{id}.
Ownership: prescription.createdBy must equal the authenticated UID. patientId is
the patient document ID, not the human-readable patientsId. Membership is read
from the server-owned patients caregivers array, never a client-selected role.

Creation uses a single client WriteBatch for the parent, all items and reminders.
getAfter plus pre-write parent nonexistence limits caregiver child writes to that
creation batch. Server timestamps prevent replay against existing parents.
Reminder recipients must equal the linked family/caregiver set. Edit mode retains
the existing reminder reconciliation flow and primary-family checks.

Existing read queries filter patientId, and reminders additionally prescriptionId.
The creation flow skips the unnecessary existing-reminder query. Reads, updates,
deletes, old document IDs and other collection rules are unchanged.

Validation: run scripts/care-target-access.test.cjs against demo-invite-expiry on
127.0.0.1:8198, scripts/rbac-flow-ui.test.cjs, and TypeScript checks. Security
regressions cover unauthorized roles, forged creator, timestamp replay, cross-
patient reminders, recipient injection, existing-parent extensions and revoked
membership. These are scoped regression checks, not a comprehensive schema audit.

2026-09-21 results: all 131 scripts tests passed against the local emulator. The
rules compiled and all new atomic creation / denial tests passed. TypeScript
passed; scoped ESLint passed after removing a duplicate import. No production
deployment, real OCR request, phone test or remote branch merge was performed.

I've set up prototype Security Rules to keep the data in Firestore safe. They are
designed to be secure for caregiver creation by checking patient membership,
creator identity, server timestamps and an atomic new-parent boundary. However,
you should review and verify them before broadly sharing your app. If you'd like,
I can help you harden these rules.
