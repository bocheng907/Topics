# Invite expiry scope and verification

> Historical 2026-09-12 implementation below. Superseded locally by the
> patient-read isolation patch: direct client creation/join is now denied;
> callables validate the same 24-hour boundary. See
> ../docs/FIRESTORE_ACCESS_HARDENING.md for deployment order and current tests.

- Existing Expo clients create a six-character inviteCode with each patient and serverTimestamp createdAt.
- Join queries patients by inviteCode and appends only the authenticated UID to families or caregivers.
- Existing member queries use array-contains. Read queries are unchanged in this scoped patch.
- Only emergency contacts currently update patient profile fields in the app.
- Expiry is createdAt + 24 hours (exclusive). No database migration or existing membership removal.
- Missing, invalid or future creation times cannot authorize joining. Old codes older than 24 hours expire immediately when Rules are deployed.
- No renewal, single-use, revocation or approval workflow is introduced.
- Rules protect createdAt, createdBy and inviteCode from client updates. A joining client can append only its own UID to one membership list, only during the validity window. Existing members cannot use the ordinary profile-update branch to add members.
- Existing broad authenticated patient reads remain a known separate security limitation: this change is expiry enforcement, not complete invitation security.
- Threat checks: expired/exact-boundary/future/missing timestamps; clock tampering; combined profile/membership changes; adding another UID; modifying both lists; timestamp reset. Rules require server request.time and isolate membership updates.

## Validation (2026-09-12)

- Firebase Rules dry-run compilation passed; this does not deploy the Rules.
- 21 local tests passed against the demo Firestore emulator (including 8 UI boundary assertions).
- Existing member contact updates still work after expiry; all tested expiry/immutable-field/membership bypasses were denied.
- Re-run from the repository root:
  `firebase emulators:exec --only firestore --project demo-invite-expiry --config firebase.invite-test.json "node --test scripts/invite-expiry.test.cjs"`
- Test runner refuses any host except the configured local emulator. No production data is created or removed.
- This is a scoped rules prototype, not a full security audit. Broad patient reads and other pre-existing rule weaknesses are not addressed here.
- Deployment is still required for server-side enforcement; the app must also be updated for the new localized expiry messages.
