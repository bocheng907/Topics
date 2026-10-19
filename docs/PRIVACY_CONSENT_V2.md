# Privacy release 2026-09-22.v2

The immutable v1 HTML remains published. New registrations use v2 and record
`privacyConsent.accepted=true`, version `2026-09-22.v2`, and the Firestore
server request time. Existing v1 consent records are not rewritten.

V2 reflects the self-service My Data, JSON export, two-stage account deletion,
retention schedule, role-based access, invite approval and primary-family
transfer features. It discloses that OCR uses unencrypted HTTP in both
development and production, as configured by the project owner.

The public current-policy redirects point to:

https://smart-care-system-1a41e.web.app/privacy/2026-09-22-v2

Deploy the App source, Firestore/Storage Rules, indexes, Functions and Hosting
together after emulator and build verification. Enabling the Firebase Google
provider, setting the Firebase password policy, configuring a real HTTPS OCR
endpoint, and verifying scheduled cleanup are separate console/cloud operations
that must be confirmed against the production project.
