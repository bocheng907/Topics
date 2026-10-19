# Community integration security model

Local integration only; the production CLI credential is expired. No production
database change or edition change is attempted. Tests target demo-rules-test.

Existing patient, agency, consent, export and lifecycle rules remain unchanged.
Community profile reads use the existing owner-only users query (uid equality).
Community feed queries filter status=published and order by viewCount or createdAt;
my-post queries filter authorUid. Comments are scoped beneath a single post.

user_roles binds uid, role and userDocId to an existing owner profile. Mapping
changes are not a role-switch mechanism. Caregivers and pending-deletion users
must not access community data. Hidden posts/comments are author-only.

Counters require bidirectional action verification: a comment mutation and its
parent counter change must be in one atomic write. lastCommentId identifies the
exact action, prevents batching several comments with one increment, and does not
authorize changing content or ownership. Likes/reports also require matching
tracking documents. View writes enforce a 24-hour server-time interval.

Image Storage reads require a published parent or its owner. Bearer download URLs
already issued are not revoked by Rules; no claim of their revocation is made.
Post deletion denies orphaned subcollection reads, but physical cleanup and account
lifecycle coverage must be verified separately before claiming integration complete.
