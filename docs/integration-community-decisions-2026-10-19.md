# Caregiver community integration decisions

Incoming: `origin/feature/caregiver-community` at `9cb3220ab6bd94b132c305e9820f2db5271c8aaa`.
Original HEAD: `88fc42d3633592b9aa8cc8673ef9bbc453190ab0`.
Local safety snapshot: `e7c96f9e8b75cc348ab89cd4c4124300ef0e4879`.
Recovery branch: `codex/backup-before-community-20261019-dbfd54` (local only; do not push).

## 1. Expo upgrade - selected A

The user explicitly selected A: integrate the incoming Expo 57 upgrade,
including its audio/video dependency migration. Validate dependency consistency,
TypeScript, regressions and the available device execution workflow after integration.
Selection is approval to integrate, not evidence that migration or device testing has passed.

## Existing decisions remain applicable

Preserve `integration-agency-decisions-2026-10-14.md` decisions unless the user
explicitly changes them. In particular, only linked caregivers scan/create prescriptions;
the local family camera and scan-result routes are compatibility redirects, not working
family scan features. Preserve safe stale-link handling when resolving their deletion conflict.
Keep current responsive layout, actual medication progress, handover reliability,
privacy, export, retention, account lifecycle and scoped authorization protections.

## 2. Cancel joining a care target - selected A

Local code unconditionally routes the skip button to the caregiver home, including
for a family account. Incoming code permits caregivers to skip, but signs family
accounts out and returns them to login. The user selected A: keep the session and
return family accounts to their home. Without linked targets, show create/join
guidance instead of redirecting automatically or rendering patient care cards.
Caregivers may still skip binding. Disable cancellation while a join is submitting.
Applied locally to join.tsx and the family homepage; preserve during final merge.

## Boundaries

## Conflict review: preserve established behavior

- Family-only chat translation conflicts: keep the local English and Vietnamese
  descriptions that only family members join this room. Do not adopt the incoming
  text that also includes caregivers; the separate shared room remains available.
- Preserve UUID naming for all patient media, rather than restoring incoming
  readable timestamp filenames for voice and abnormal media.
- Preserve actual medication progress, responsive layout, handover acknowledgments
  and leave-target state cleanup. These are existing approved features, not choices
  to discard implicitly when taking incoming files.

## 3. Community audience - selected A

Incoming `isCommunityUser()` permits only family and agency roles in Firestore
and Storage. Community route wrappers are also only supplied for those roles.
The user explicitly selected A: retain the incoming family/agency-only audience.
Caregivers must be denied community reads and writes, including direct SDK access
to posts, comments and images. Do not add caregiver community routes.
This decision concerns community posts only, not family chat or patient records.
Validate role enforcement in the emulator during integration; selection alone
does not establish that the rules have been integrated, tested or deployed.

## 4. Hidden community posts - selected A

Incoming code automatically hides posts at three reports. The feed and normal
detail API filter hidden posts, but Firestore permits every community member to
read them directly. The user selected A: deny other community members access
to hidden posts and their comments while retaining the author's own-post access.
Do not silently add an administrator role or grant audit-log administrators
community moderation privileges. Any strengthened visibility must cover comments
and Storage SDK reads as well; previously distributed media download URLs require
separate token handling and cannot be claimed revoked by Rules alone.

## Preliminary community rules review

Static inspection only; no emulator verification or production change:

```json
{
  "score": 2,
  "summary": "Incoming community scope only; not a full application audit. Counter integrity requires correction before integration is considered validated.",
  "findings": [
    {
      "check": "Business Logic vs. Rules",
      "severity": "major",
      "issue": "commentBump permits any community user to change commentCount by one without requiring a corresponding comment creation or deletion.",
      "recommendation": "Bind counter changes to authorized comment mutations or maintain counters in a trusted backend; verify with negative emulator tests."
    },
    {
      "check": "Business Logic vs. Rules",
      "severity": "moderate",
      "issue": "Hidden posts remain readable under isCommunityUser; filtering is in the client. This is list hiding, not confidentiality or enforced removal.",
      "recommendation": "Document the intended moderation semantics and enforce any intended read restriction in rules and matching queries."
    }
  ]
}
```

## Integration boundaries

Integration started with incoming standalone content formatting/filtering and
document ID helpers. Existing application files remain under TypeScript checking;
only node_modules and output artifacts are excluded. Do not adopt the incoming
tsconfig exclusions for application tabs, components, hooks or constants.
The upload patient-ID validation, forgetCareTarget cleanup and family-only chat
translation conflicts resolve to the existing local contents (no source change needed).

Preflight found 39 conflicting paths, resolved by content integration preserving
the decisions above. Subsequent user instructions authorize finishing the merge,
creating a new branch, committing and pushing it. Production deployment is separate.

Final accounting: `node scripts/verify-community-integration.cjs` covers all 113
incoming paths, including two compatibility redirects and five deliberate exclusions
(historical notes, unused prototype, and bulk role script superseded by the callable).
Do not interpret exclusions as missing App functionality.

Regression fixes preserve immutable patient familyGroupId, allow profile edits when
an unchanged activePatientId is stale, support calendar *_zh edits, and allow missing
threshold reads without exposing existing documents to nonmembers. All local media
uploads now share XMLHttpRequest blob loading, avoiding Expo 57 fetch(file://) and
uncommitted environment dependencies. Native media still needs device acceptance.
