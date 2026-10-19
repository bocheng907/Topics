export type CareChatRoom = "caregiver" | "family";

export const FAMILY_GROUP_COLOR = "#8B78D7";

export function normalizeChatRoom(value?: string | string[]): CareChatRoom {
  return (Array.isArray(value) ? value[0] : value) === "family"
    ? "family"
    : "caregiver";
}

// Both rooms are fixed to the care target. Users never create arbitrary rooms.
export function chatMessageCollection(room: CareChatRoom) {
  return room === "family" ? "familyMessages" : "messages";
}
