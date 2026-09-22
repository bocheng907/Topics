import { randomUUID } from "expo-crypto";

/** Generate a new name per upload; keep existing Storage folder conventions. */
export function createImageUploadFilename(): string {
  return `${randomUUID()}.jpg`;
}
