import { randomUUID } from "expo-crypto";

/** Generate a new name per upload; keep existing Storage folder conventions. */
export function createImageUploadFilename(): string {
  return createMediaUploadFilename("jpg");
}

export function createMediaUploadFilename(extension: string): string {
  const normalized = extension.trim().toLowerCase().replace(/^\./, "");
  if (!["jpg", "jpeg", "png", "mp4", "mov", "m4a"].includes(normalized)) {
    throw new Error("Unsupported upload extension");
  }
  return `${randomUUID()}${"."}${normalized}`;
}
