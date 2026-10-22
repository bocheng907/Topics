import Constants from "expo-constants";

export interface AnalyzedMedicine {
  drug_name: string;
  dosage?: string | null;
  quantity: string;
  usage_zh: string;
  note_zh?: string | null;
  common_uses?: string | null;
}

export interface AnalyzeResult {
  clinic_name?: string;
  visit_date?: string | null;
  patient_name?: string | null;
  medicines: AnalyzedMedicine[];
  memo?: string | null;
  raw_text?: string;
}

export interface TranslationResult {
  detected_language: string;
  target_language: string;
  original_text: string;
  translated_text: string;
}

export interface BatchTranslationItem {
  key: string;
  text: string;
}

export interface BatchTranslationResult {
  target_language: string;
  translations: { key: string; translated_text: string; cached: boolean }[];
}

function getPrescriptionApiBaseUrl() {
  const baseUrl = process.env.EXPO_PUBLIC_PRESCRIPTION_API_BASE_URL ||
    Constants.expoConfig?.extra?.prescriptionApiBaseUrl;

  if (typeof baseUrl !== "string" || !baseUrl.trim()) {
    throw new Error(
      "OCR is unavailable: configure EXPO_PUBLIC_PRESCRIPTION_API_BASE_URL"
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("OCR is unavailable: invalid API URL");
  }
  const allowInsecureHttp =
    Constants.expoConfig?.extra?.allowInsecurePrescriptionApi === true &&
    parsed.protocol === "http:";
  if (parsed.protocol !== "https:" && !allowInsecureHttp) {
    throw new Error("OCR is unavailable: insecure HTTP endpoints are blocked");
  }
  if (parsed.username || parsed.password) {
    throw new Error("OCR is unavailable: credentials cannot be embedded in the URL");
  }
  return baseUrl.replace(/\/+$/, "");
}

function getPrescriptionAnalyzeUrl() {
  return `${getPrescriptionApiBaseUrl()}/analyze/url`;
}

function getPrescriptionTranslateUrl() {
  return `${getPrescriptionApiBaseUrl()}/translate`;
}

export async function analyzePrescriptionByUrl(imageUrl: string): Promise<AnalyzeResult> {
  const failure = (code: string) => Object.assign(new Error("Prescription analysis failed"), { code });
  let url: string;
  try { url = getPrescriptionAnalyzeUrl(); } catch { throw failure("ocr/unavailable"); }
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl }),
    });
  } catch {
    throw failure("ocr/network");
  }
  if (!response.ok) {
    throw failure(response.status === 429 ? "ocr/busy" : response.status >= 500 ? "ocr/unavailable" : "ocr/recognition");
  }
  let text: string;
  try { text = await response.text(); } catch { throw failure("ocr/network"); }
  try {
    return JSON.parse(text) as AnalyzeResult;
  } catch {
    throw failure("ocr/recognition");
  }
}

export async function translateText(
  textToTranslate: string,
  targetLanguage = "English"
): Promise<TranslationResult> {
  let response: Response;

  try {
    response = await fetch(getPrescriptionTranslateUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: textToTranslate,
        target_language: targetLanguage,
      }),
    });
  } catch (err: any) {
    throw new Error(`Network request failed: ${String(err?.message ?? err)}`);
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`AI translate failed (${response.status}): ${text}`);
  }

  try {
    return JSON.parse(text) as TranslationResult;
  } catch {
    throw new Error(`AI translate returned non-JSON: ${text}`);
  }
}

export async function translateTexts(
  items: BatchTranslationItem[],
  targetLanguage: string
): Promise<BatchTranslationResult> {
  if (items.length === 0) {
    return { target_language: targetLanguage, translations: [] };
  }

  let response: Response;
  try {
    response = await fetch(`${getPrescriptionApiBaseUrl()}/translate/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, target_language: targetLanguage }),
    });
  } catch (err: any) {
    throw new Error(`Network request failed: ${String(err?.message ?? err)}`);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`AI batch translate failed (${response.status}): ${text}`);
  }

  try {
    return JSON.parse(text) as BatchTranslationResult;
  } catch {
    throw new Error(`AI batch translate returned non-JSON: ${text}`);
  }
}
