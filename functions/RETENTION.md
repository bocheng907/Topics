# Data retention

`cleanupExpiredData` runs daily at 03:00 Asia/Taipei. It defaults to
`RETENTION_DRY_RUN=true`; this counts eligible rows without deleting anything.

| Collection | Calendar months |
| --- | --- |
| health_records | 60 |
| prescriptions | 36 |
| abnormal_records | 12 |
| chats/{patientId}/messages | 6 |
| notifications | 3 |
| audit_logs | 12 |

Deploy the Firestore indexes first and wait for the messages collection-group
index to become ready. Deploy `functions:cleanupExpiredData` on a Blaze project.
Inspect the aggregate `retention` log before enabling deletion. To enable,
set `RETENTION_DRY_RUN=false` in the Functions project's environment file and
redeploy this function. Setting true and redeploying stops new deletions and
pending cleanup. This repository change does not deploy or delete cloud data.

Expiry uses Firestore `createdAt` timestamps, strict less-than, calendar-month
subtraction and Taipei time. Missing/non-timestamp dates are not deleted.
Folders containing newer or undated entries are retained as a whole; they may
therefore exceed the nominal retention period and need manual review. This
avoids deleting newly added media based on the folder creation date.

Up to 1,000 candidates per collection are scanned per invocation (100 per page).
Large backlogs or more than 1,000 retained/invalid old folders require operator
review; this is a bounded job, not a guaranteed same-day purge of every record.

Each eligible document is atomically removed with a last-update precondition
and a durable `_retention_jobs` cleanup record. Concurrent edits prevent that
commit. Storage removal happens afterward; failed jobs remain for retry.
Only Firebase download URLs for the configured bucket and expected patient/user
prefix are accepted. Missing objects are retry-safe. Prescription item
subcollections and associated medication reminders are also removed. Medication
logs, patients, users, care notes and voice records have no policy here and are
retained. Account deletion and its 30-day grace period are a separate feature.

Do not grant clients access to `_retention_jobs`; the existing default-deny
Firestore rules protect it. Logs contain counts, not health data or download
tokens. Backups, versioned Storage objects, externally shared copies and cloud
audit logs require separate retention policies. No recovery backup is created
by this job; use dry-run results to review scope before enabling deletion.

## Emulator integration test

Run the synthetic delete-and-preserve scenario from the repository root:

```powershell
npx -y firebase-tools@latest emulators:exec --only firestore,storage --project demo-invite-expiry --config firebase.retention-test.json "node --test functions/retention.emulator.cjs"
```

The dedicated config binds to local ports 18198/19298 and uses a demo project;
the test refuses any other Firestore host or non-demo project. It creates old
and recent synthetic records and media, verifies actual deletion/preservation,
then Firebase CLI shuts down the emulators. Never point this test at production.
