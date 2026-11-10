/** Normalise empty OCR values without showing "null" to the user. */
export function cleanOcrText(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = String(value).trim();
  return /^(null|undefined)$/i.test(text) ? "" : text;
}

export function medicineName(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  const record = item as Record<string, unknown>;
  for (const key of ["drug_name_zh", "drug_name", "name"]) {
    if (typeof record[key] !== "string") continue;
    const name = cleanOcrText(record[key]);
    if (name && name !== "（未辨識藥品名稱）") return name;
  }
  return "";
}

export function hasRecognizedMedicine(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const medicines = (result as { medicines?: unknown }).medicines;
  return Array.isArray(medicines) && medicines.some(item => !!medicineName(item));
}

export function hasValidMedicineNames(items: { name: string }[]): boolean {
  return items.length > 0 && items.every(item => !!medicineName({ name: item.name }));
}
