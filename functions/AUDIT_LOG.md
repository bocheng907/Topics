# Audit log

Server-owned `audit_logs` records cover prescription headers/items (create,
update, delete), patient membership changes and health thresholds. Firestore
auth-context triggers provide actorId/actorType; these may identify a service
account or unknown principal, and must not be interpreted as a guaranteed
Firebase user UID. No client-supplied updatedBy field is trusted. Delivery is
asynchronous, retry-enabled and deduplicated by source plus CloudEvent ID.

Records store operation, resource path, patient reference where present, changed
field names, event time and server creation time. Medical field values, passwords,
email addresses, download tokens and IP addresses are not copied. This identifies
which fields changed, not their full before/after values. Member arrays are not
copied. Item records can be linked through their prescription resource path.

App login reports and logout requests use `recordSessionAudit`. The callable
requires authentication, validates the operation and derives identity/auth_time
from the token. One event of each type per token auth_time is stored. These are
explicitly labelled authenticated client signals: a user can replay/omit a signal,
and a logout request is not proof that local sign-out completed. Offline/failing
delivery logs a warning and does not block sign-out. App termination, token expiry,
failed login attempts and authentication through another client are not covered.

Rules deny all client creation/update/deletion. Only a trusted administrator with
the `auditAdmin: true` custom claim can read (via console/SDK). Do not derive this
claim from a user-editable profile. Admin SDK/IAM remains privileged; this is not
WORM storage or a substitute for cloud audit logs. Existing access-control defects
in other collections are not fixed by adding audit logs.

Deploy only recordSessionAudit, auditPrescription, auditPrescriptionItem,
auditCareMembers and auditHealthThreshold after reviewing the current Rules diff.
Deploy the audit_logs Rules before exposing logs. App clients must be rebuilt or
updated to use session reporting. No historical backfill is performed. The
`/audit-logs` screen is available from the family/caregiver sidebar for accounts
with the auditAdmin claim. It checks token claims, fetches 50 server records per
page ordered by createdAt, and clears records on account/permission changes.
Search applies only to loaded records; load additional pages to expand search.
Details include event and receipt times, actor source, resource and changed fields.
There are no client edit/delete actions. Refresh the ID token or sign in again
after receiving the claim. The existing retention job covers audit_logs.createdAt
after 12 calendar months; its current dry-run setting controls actual deletion.
