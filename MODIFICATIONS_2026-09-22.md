# 2026-09-22 changes

- Family group chat is family-only. Caregiver family-group UI was removed and Firestore `familyMessages` access now requires membership in the patient's `families` array.
- Removed the family-side prescription scanning entry and family scan routes. Prescription scanning remains on the caregiver side.
- Fixed caregiver DONE recording by removing the pre-create transaction read of a non-existent medication log, which was denied by Firestore rules.
- Added Account Settings to both family and caregiver hamburger menus, with display-name editing and avatar upload.
- Firestore user profile rules now allow `displayName` and `avatarUrl` updates by the profile owner.

After updating production, deploy Firestore rules:

    firebase deploy --only firestore:rules


## Follow-up: caregiver prescription deletion + multilingual layout
- Caregivers can delete prescriptions that they personally created for the active care target. Primary family users retain broader management rights.
- Prescription deletion cascades to prescription items and medication reminders; medication logs remain immutable history.
- Added responsive wrapping/scaling for caregiver prescription tabs, prescription cards, medication cards, medication reminder headings, and both role drawers.
- Widened drawer layout for longer English/Vietnamese/Indonesian labels.
- Added translated caregiver medication-list labels and disclaimer copy for zh/en/vi/id.
- Firestore rules changed and must be deployed for caregiver deletion to work.


## v3 fixes
- Caregiver can scan/create/edit/delete prescriptions for linked patients.
- Family can edit/delete prescriptions but family scan entry remains removed.
- Prescription reminders can be refreshed by either linked caregiver or family during edits.
- Caregiver drawer width reduced from 74%/340 to 66%/300.
- Caregiver home grid labels now use full card width and a smaller 2-line responsive font for EN/VI/ID.

## v4
- Family add-care-target screen now also accepts an invite code to join an existing elder.
- Firestore real-time listeners no longer require composite indexes for patient/recipient + createdAt; filtering stays server-side and sorting/limits are applied client-side.
- Registration normalizes common full-width/whitespace email input before Firebase Auth validation.

## v5 family invite behavior
- Family accounts using a valid elder invite code are added immediately to `patients.families`.
- No primary-family approval is required for family invite joins.
- Caregiver invitation approval behavior is unchanged.
