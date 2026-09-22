# Privacy release 2026-09-12.v1

Provider and public contact were supplied and approved by the project owner.
Publish only privacy-hosting, not the full application. The existing Hosting site had no releases at initial inspection.

## Data contract

Preserve existing custom user document IDs, uid queries and all legacy data.
New profiles require privacyConsent: {accepted: true, version: "2026-09-12.v1", acceptedAt: serverTimestamp()}.
Rules enforce the exact version and server request.time on create. Clients cannot change/remove consent on update. Existing profiles without consent remain usable; do not fabricate legacy acceptance.
No new collection or index. Registration checks consent before Firebase Auth creation. The auth listener no longer auto-creates user profiles or a fallback family role; registration suppresses it to prevent a profile race.
An interrupted profile write can be retried only after password reauthentication and confirming no profile exists.

## Limits and rollout

This records an authenticated declaration, not proof that a person read the policy. Direct Firebase Auth signup remains possible; Rules prevent creating an app profile without a consent declaration. Other existing broad Rules are outside this change.
This is not separate health-data/AI consent or evidence of authority for another person's data. Existing accounts are not forced through re-consent.
Policy discloses HTTP OCR, broad patient/health reads, incomplete RBAC and retention dry-run. Publication is not remediation or a legal compliance certification.
Old apps cannot create profiles under the new Rules. Existing accounts still work; update the app for the checkbox and policy links.
Versioned HTML must not be edited after acceptance. Publish a new version and update URL, UI version and Rules together; retain historical versions.
No analytics, external scripts or external fonts are embedded in the policy page. Hosting infrastructure logging is separate.

## Validation

59 automated tests passed: 25 privacy unit/Rules cases, 21 invitation cases, 13 password cases.
Run: `firebase emulators:exec --only firestore --project demo-invite-expiry --config firebase.privacy-test.json "node --test scripts/privacy-consent.test.cjs scripts/invite-expiry.test.cjs scripts/password-policy.test.cjs"`.
TypeScript, scoped ESLint, Rules dry-run compilation and Expo Web export passed.
Playwright verified the mobile registration page defaults to unchecked/disabled, enables submission after explicit checking, and exposes the public policy link. No real Auth accounts were created during validation.
Screenshots are kept under output/playwright. Full native-device and authenticated registration E2E were not performed.

## Published

2026-09-12: Hosting and Firestore Rules deployed successfully. HTTPS policy returned 200 and its HTML matched the local version. Live Rules matched the tested file (ruleset 06e56d6a-d6fa-4f6c-a3f9-19cc342b5473).
Public URL: https://smart-care-system-1a41e.web.app/privacy/2026-09-12-v1
The Expo app changes are local source; installed apps still require an update. No Functions were redeployed and no production user records were changed during validation.
