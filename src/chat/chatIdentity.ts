export type ChatIdentity = { displayName: string; avatarUrl: string };

export function chatIdentity(
  message: { senderId?: string; senderName?: string; senderAvatarUrl?: string },
  profiles: Record<string, ChatIdentity>,
  fallback: string,
): ChatIdentity {
  const profile = message.senderId ? profiles[message.senderId] : undefined;
  return {
    displayName: (profile ? profile.displayName : message.senderName)?.trim() || fallback,
    // An intentionally cleared avatar must not revive the historical image.
    avatarUrl: (profile ? profile.avatarUrl : message.senderAvatarUrl)?.trim() || "",
  };
}
