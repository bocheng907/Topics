import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { type ExportPayload, validateExportPayload } from "./exportPayload";

export async function saveExport(payload: ExportPayload, uid: string): Promise<void> {
  validateExportPayload(payload, uid);
  if (!FileSystem.cacheDirectory || !await Sharing.isAvailableAsync()) {
    throw new Error("sharing-unavailable");
  }
  const uri = FileSystem.cacheDirectory + payload.filename;
  try {
    await FileSystem.writeAsStringAsync(uri, payload.json, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await Sharing.shareAsync(uri, {mimeType: "application/json", UTI: "public.json"});
  } finally {
    await FileSystem.deleteAsync(uri, {idempotent: true});
  }
}
