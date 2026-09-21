# Patient read isolation (deployed prototype)

Scope: patients and health_records confidentiality, plus compatible create/join
flows. Database: smart-care-system-1a41e/(default), STANDARD, nam5 (verified
2026-09-13). No existing documents or identifiers are migrated.

## Contracts and findings before this patch

- patients document IDs differ from patientsId; membership is stored in
  families/caregivers UID arrays. Existing linked queries use array-contains.
- Health charts/dashboard query health_records.patientId with createdAt order
  and limits 10/300. patientId references the patients document ID.
- Legacy create queries all patients by patientsId; join queries by inviteCode
  and directly appends a UID. Both require replacement before read isolation.
- Rules currently allow any signed-in account to read both collections.
- Direct self-append without code verification bypasses read isolation if a
  document ID is known. Disable it; verify codes inside an authenticated callable.
- Keep current family/caregiver membership semantics, not primary/secondary RBAC.
- Preserve all unrelated collection rules. This is not a full schema audit.

## Implemented server boundary

createCareTarget/joinCareTarget read the caller's unique legacy users profile
by uid (never trust the supplied role), reject pending account deletion, validate
inputs, and use transactions. Creation retains timestamp_pat_suffix document IDs
and the existing eight-character patientsId. A private lock serializes creation
uniqueness checks. Invite codes use cryptographic random characters, retain the
24-hour createdAt deadline, and ambiguous legacy duplicates fail closed.
Join attempts are limited per UID; this is not protection against many accounts.
Private bookkeeping stores no invite codes or health values and is client-denied.
Per-UID limits are 10 join attempts per 10 minutes and 10 create attempts per day,
including invalid requests after identity verification. Limit documents live at
users/{profileDocId}/_care_target_limits/{action}, so existing recursive account
deletion removes them. The one global _care_target_locks/create document contains
only updatedAt. No existing data is migrated.
Existing members may retry their own valid code after expiry without granting
new membership. No public lookup endpoint is introduced.

## Deployment gate

Backend and Rules deployed on 2026-09-13 with explicit owner approval.
The compatible App source is updated locally; an App release was not performed
by this deployment. Old App create/join flows are now denied by Rules.
For future releases, deploy callables, update the App, then tighten Rules.
Existing records remain in place.

Deployment commands and App rollout order, from the repository root:

1. firebase deploy --only functions:createCareTarget,functions:joinCareTarget --project smart-care-system-1a41e
2. Release/test the updated App's create and join screens.
3. firebase deploy --only firestore:rules --project smart-care-system-1a41e
4. Verify non-member denial and linked queries with dedicated test accounts.

Before deployment, review legacy documents against the validators: unusual or
incomplete profiles/health records remain readable by members but may no longer
be editable. Duplicate invite codes or duplicate user profiles are rejected,
never arbitrarily selected. New create responses are not idempotent after an
uncertain network failure; check the linked list before manually creating again.
Per-account quotas do not prevent multi-account abuse; App Check is not enabled
by this patch. Invitations are still reusable within 24 hours; single-use,
revocation, approval and primary/secondary family roles remain separate work.
Cloud Functions audit triggers still observe server writes; attributing those
writes to the originating App user is not added here.

## Local verification

Final observed results (2026-09-13):

- 69/69 emulator integration, invite and consent tests passed on the final code.
- 35/35 Functions tests passed.
- Functions lint, scoped App/test lint, TypeScript noEmit and git diff --check
  passed.
- Five further rounds of both concurrent tests passed (10/10).
- One earlier full run reported 68/69; the retained tool output truncated the
  individual error. It was not reproduced in the subsequent full run or five
  concurrency rounds, so the underlying cause is not established. Keep this
  observation for staging verification rather than treating retries as a fix.
- No production deployment, phone upload or deployed callable HTTP test was
  performed. All generated test documents belong to the local demo emulator.

The bullet above records the local-test phase. Subsequent production deployment:

- createCareTarget and joinCareTarget: deployed successfully in us-central1,
  both ACTIVE.
- Each deployed callable was probed without authentication: HTTP 401 with
  UNAUTHENTICATED, as expected. No real patient was created or joined.
- Firestore Rules: compile and deploy succeeded. Released ruleset
  bf0d62a3-9596-443c-8f9c-45fce0e7d4e3 matches the local file after CRLF
  normalization.
- Prior ruleset: 06e56d6a-d6fa-4f6c-a3f9-19cc342b5473.
- No Hosting/App release, index deployment, retention invocation or existing
  data deletion was performed. Authenticated production App testing remains.

The emulator tests exercise the actual Rules via authenticated/unauthenticated
Firestore REST requests and the callable service handlers against the same local
database. They do not exercise the deployed callable HTTP transport or a phone.
All test scripts refuse production Firestore endpoints.

Command:
firebase emulators:exec --only firestore --project demo-invite-expiry --config firebase.privacy-test.json "node --test scripts/care-target-access.test.cjs scripts/invite-expiry.test.cjs scripts/privacy-consent.test.cjs"

Attack checks in the scoped collections:

- Anonymous/non-member get and blanket list: denied.
- Invite-code lookup and direct membership self-append: denied.
- Member list and patient-filtered ordered health chart query: allowed.
- Wrong patient/author, immutable ID and membership replacement: denied.
- Missing required fields, invalid types, unknown fields, oversized values: denied.
- Removed member and pending-deletion user: denied.
- Orphan health record without patient: denied.
- False caller role/UID on callable: ignored in favor of authenticated profile.
- Missing/ambiguous profile, invalid/expired/ambiguous invite: rejected.
- Rate limit reset via client: denied; invalid guesses consume quota.
- Concurrent joins preserve both members; concurrent creates get unique IDs.
- Existing consent protections and legacy profile contact updates: preserved.

No assertion is made that unrelated Rules are fully hardened. This is a scoped
prototype, not a security certification; review and device testing are required
before broad distribution.

## Initial static assessment (Rules auditor)

```json
{"score":1,"summary":"Authenticated patient and health data leak","findings":[{"check":"Unauthorized read","severity":"critical","issue":"Blanket signed-in reads expose unrelated patients and health records","recommendation":"Require existing patient membership and route invite lookup through trusted backend"},{"check":"Authority source","severity":"critical","issue":"Direct self-append does not prove knowledge of an invite code","recommendation":"Deny client membership changes"}]}
```
