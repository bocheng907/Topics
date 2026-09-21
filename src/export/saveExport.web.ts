import { type ExportPayload, validateExportPayload } from "./exportPayload";

export async function saveExport(payload: ExportPayload, uid: string): Promise<void> {
  validateExportPayload(payload, uid);
  const url = URL.createObjectURL(new Blob([payload.json], {type: "application/json;charset=utf-8"}));
  const anchor = document.createElement("a");
  try {
    anchor.href = url;
    anchor.download = payload.filename;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}
