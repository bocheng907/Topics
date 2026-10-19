# Agency integration decisions

Target: `origin/feature/agency-management-latest` at `703b0fe9ce7dcf3132c81810d9e61fed30771039`.
Original HEAD: `88fc42d3633592b9aa8cc8673ef9bbc453190ab0`.
Local recovery snapshot: `83010e97fca7d29b9036d8c61c578983d65a0152`.
Recovery ref: `refs/codex/backups/integrate-agency-20261014-230328`.

## 1. Prescription permissions — selected B

The user explicitly selected B on 2026-10-14:
- Only caregivers assigned to the patient can scan/create prescriptions.
- All family members and caregivers assigned to the patient can edit/delete prescriptions.
- Remove the family scan entry and its routes; handle stale navigation safely.
- Implement consistently in client guards, Firestore/Storage access where applicable, and tests.

Status: applied locally and emulator-tested. Not deployed. Other security/lifecycle behavior is not implicitly overridden by this choice.

## 2. Chat rooms — selected B

The user explicitly selected B:
- Preserve the existing family/caregiver room and its messages.
- Add a separate family-only room; caregivers must not read or write it.
- Keep client navigation, Firestore/Storage authorization, export, retention and deletion consistent with this separation.
- Correct incoming documentation to describe the family-only room accurately.

Status: applied locally, including family-only Rules, media, export, retention and account deletion. Emulator-tested; not deployed.

Current local implementation uses `chats/{patientId}/messages` for linked family/caregiver members.
Incoming implementation preserves that room and adds `familyMessages` for family members only.
Incoming caregiver UI fixes room type to caregiver; incoming Firestore Rules use `isFamilyMember` for `familyMessages`.
Incoming `docs/FAMILY_CARE_GROUP.md` incorrectly describes the family room as shared with caregivers; align documentation with the user-selected behavior during integration.

No existing messages should be deleted or silently migrated.

## 3. Account roles and agency workflow — selected B

The user explicitly selected B:
- Add self-selectable agency registration and agency navigation.
- Integrate agency management, caregiver binding and report workflows.
- Preserve existing password strength, privacy consent, audit and account-lifecycle protections.
- Agency registration alone must not grant access to all patients.

Status: applied locally with server-controlled agency invitations/binding and scoped access. Emulator-tested; not deployed.

Current local registration supports family and caregiver roles.
Incoming registration adds a self-selectable agency role, agency navigation, caregiver binding and report-management workflows.
Selecting this incoming workflow does not authorize removing existing password, privacy-consent, audit or account-lifecycle protections.

## 4. Profile editing entry points — selected A

The user explicitly selected A:
- Combine complementary profile fields into one account-settings page.
- Retain display name, avatar, family emergency contacts and caregiver phone, displaying fields for the applicable role.
- Keep the old profile route compatible by directing it to the unified page.
- Preserve multilingual responsive layout and synchronize shared caregiver profile fields consistently.

Status: applied locally in account-settings; profile redirects to it. Own-profile and caregiver shared-profile authorization tested in the emulator; not deployed.

Local `app/profile.tsx` edits display name and two emergency phone numbers, with multilingual labels and responsive safe-area layout.
Incoming `app/account-settings.tsx` edits display name/avatar and caregiver phone, and synchronizes caregiver profile data for agency workflows.
Both edit the shared display name, but their other fields serve different purposes. Do not drop family emergency contacts or confuse them with the caregiver's own phone number.

Proposed choices: A combines the complementary fields into one account-settings page and keeps the old profile route compatible; B retains two separate pages with clear labels and consistent shared display-name data.

## 5. Responsive layout — selected A

The user explicitly selected A: preserve local safe areas, responsive columns, multilingual wrapping, font-scale handling and scrollable drawers/forms while integrating incoming features.

Status: approved for local integration and testing. No deployment or push is authorized by these choices.

## 6. Service summary history — preserve

User explicitly selected preserving service summaries after unlinking. Do not delete summaries from the App; distinguish retained history from current service.

## 7. Family invitations — immediate join

User explicitly selected immediate family membership with a valid invitation. Preserve expiry, single-use and revocation checks. Caregivers still require approval.

## 8. Narrow permission integration — approved 2026-10-15

After the full rules replacement was blocked, the user explicitly authorized scoped changes and local emulator tests: caregiver prescription creation; linked-member prescription editing; family-only chat/media; agency access only to bound caregivers, related service summaries/reports; own-profile editing. No production deployment.

## 9. Agency account deletion — approved 2026-10-15

At the 30-day deletion deadline, remove the agency's caregiver bindings while retaining patient care data and service summaries. Do not detach during the cancellation window. Revoke the agency invite without reusing its code. No production purge is authorized in this integration task.

Local layout includes safe-area headers, responsive card columns based on window/font scale, and scrollable responsive drawers/forms.
Incoming code includes new navigation/features but retains static drawer dimensions and line-limited/shrinking labels in overlapping pages.
Selected implementation: A preserves local responsive fixes while integrating incoming features and navigation.

## Local verification — 2026-10-15

- Combined agency, Storage access, export, extended-flow, consent, care-target and invitation regression: 101/101 passed with test-concurrency=1 on isolated demo emulators.
- Actual expired-record cleanup, including family-only messages/media: 1/1 passed in the isolated Firestore emulator.
- Functions unit tests: 50/50 passed.
- Final TypeScript check and Functions lint passed. Full frontend lint completed with 0 errors and 38 warnings; this is not a zero-warning result.
- Existing responsive browser fixtures: 24/24 passed. These do not establish authenticated agency-screen or iPhone acceptance.
- The first concurrent combined run had a Firestore transaction lock timeout (100/101); serial rerun passed without relaxing assertions. Java emitted a shutdown warning after the successful emulator command.
- Agency deletion tests verify the 30-day boundary, retained care data/summaries, removed bindings and subsequent rebinding. Auth/Storage cleanup uses test doubles in that scenario, not production accounts.

## Handoff boundaries

Content integration is local only. No deployment, push, merge commit or blanket staging has been performed. Existing uncommitted work and the recovery snapshot are preserved.

The local Firebase hosting configuration and security checks were retained instead of replacing them with incoming defaults. Incoming debug logging of sensitive prescription data was not adopted. Historical incoming modification notes are not acceptance evidence; this decision record and executable tests describe the integrated behavior.

Remaining acceptance work: authenticated new agency UI and physical-phone checks. Inactive service-summary marking is App-driven and depends on caregiver synchronization. Firebase media download URLs are bearer links; restricted SDK reads do not make a copied download URL private. No production security or production end-to-end claim is made.
