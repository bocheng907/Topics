# v5.3

- Registration now requires a display name for family and caregiver accounts.
- New user profiles store `displayName` and an empty `avatarUrl`.
- Chat messages snapshot `senderName` and `senderAvatarUrl` so family-group messages can identify the speaker without exposing all user profiles.
- Family and caregiver chat bubbles show a small avatar and sender name.
- Existing messages without sender metadata fall back to role labels.
- Firestore rules allow the new registration/profile fields and chat sender metadata.
- Storage rules add secure `profile_images/{uid}/avatar.jpg` access and retain prescription compatibility.
