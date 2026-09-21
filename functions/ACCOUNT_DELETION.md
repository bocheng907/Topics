# Account deletion

Account deletion is a two-stage, server-controlled process.

1. The signed-in email/password user reauthenticates in the app.
2. `requestAccountDeletion` verifies that `auth_time` is no more than five
   minutes old, writes `_account_deletions/{uid}`, and marks every matching user
   profile as `pending_deletion`.
3. The app signs out. A later sign-in is restricted to the cancellation screen.
4. The user may reauthenticate and call `cancelAccountDeletion` before the
   scheduled deletion time.
5. `purgeDeletedAccounts` runs daily at 02:30 Asia/Taipei. It deletes requests
   whose 30-day grace period has expired, then removes the Firebase Auth user.

The purge deletes duplicate user profiles and device tokens, documents owned by
the UID, uploaded media referenced by those documents, chat messages sent by the
UID, prescription dependents, and source notifications. For a patient shared
with another family member or caregiver, it removes the departing UID and its
owned nested data. If no member remains, it recursively deletes the patient,
patient-scoped top-level data, chat data, and patient media prefixes.

The marker is deleted last. A failed purge records an attempt and throws from
the scheduler so the operation remains retryable. Storage URLs are accepted for
deletion only when they point to the configured bucket through a Firebase
Storage URL or an equivalent `gs://` URL.

Deploying the implementation requires both Functions and Firestore Rules:

```powershell
npx firebase-tools deploy --only functions,firestore:rules
```

Do not manually remove `_account_deletions` markers unless the corresponding
request has been intentionally cancelled or the purge has been fully verified.
