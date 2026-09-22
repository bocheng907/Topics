export type ExportPayload = {
  filename: string;
  json: string;
  counts: Record<string, number>;
  skippedInaccessible: number;
};

export function validateExportPayload(value: ExportPayload, uid: string): void {
  if (!value || typeof value.json !== "string" || value.json.length > 4 * 1024 * 1024 ||
      !value.counts || typeof value.counts !== "object" || Array.isArray(value.counts) ||
      !Object.values(value.counts).every(n => Number.isSafeInteger(n) && n >= 0) ||
      !Number.isSafeInteger(value.skippedInaccessible) || value.skippedInaccessible < 0 ||
      !/^personal-data-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/.test(value.filename)) {
    throw new Error("invalid-export");
  }
  const data = JSON.parse(value.json);
  if (data.schemaVersion !== 1 || data.account?.uid !== uid) {
    throw new Error("wrong-export-owner");
  }
}
