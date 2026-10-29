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

function serviceFailure(service: string, reason: string) {
  // Never surface server HTML, response bodies or internal URLs to the user.
  return Object.assign(new Error("服務暫時無法完成處理，請稍後再試。"), { code: `${service}/${reason}` });
}

// The deadline covers both connection and body download, even if a transport
// does not settle after abort. Always detach listeners and clear the timer.
export async function requestServiceJson<T>(
  url: string, body: unknown, service: "ocr" | "translation",
  timeoutMs: number, signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    cancel = () => {
      reject(serviceFailure(service, "cancelled"));
      controller.abort();
    };
    timer = setTimeout(() => {
      reject(serviceFailure(service, "timeout"));
      controller.abort();
    }, timeoutMs);
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
  });
  const request = async () => {
    if (controller.signal.aborted) throw serviceFailure(service, "cancelled");
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: controller.signal,
      });
    } catch { throw serviceFailure(service, "network"); }
    if (!response.ok) {
      throw serviceFailure(service, response.status === 429 ? "busy" : response.status >= 500 ? "unavailable" : "recognition");
    }
    let text: string;
    try { text = await response.text(); } catch { throw serviceFailure(service, "network"); }
    try { return JSON.parse(text) as T; } catch { throw serviceFailure(service, "recognition"); }
  };
  try {
    return await Promise.race([interrupted, request()]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

export async function analyzePrescriptionByUrl(imageUrl: string): Promise<AnalyzeResult> {
  let url: string;
  try { url = getPrescriptionAnalyzeUrl(); } catch { throw serviceFailure("ocr", "unavailable"); }
  const result = await requestServiceJson<AnalyzeResult>(url, { image_url: imageUrl }, "ocr", 45000);
  if (!result || !Array.isArray(result.medicines)) throw serviceFailure("ocr", "recognition");
  return result;
}

export async function translateText(
  textToTranslate: string,
  targetLanguage = "English"
): Promise<TranslationResult> {
  let url: string;
  try { url = `${getPrescriptionApiBaseUrl()}/translate`; } catch { throw serviceFailure("translation", "unavailable"); }
  const result = await requestServiceJson<TranslationResult>(url, {
    text: textToTranslate, target_language: targetLanguage,
  }, "translation", 30000);
  if (!result || typeof result.translated_text !== "string" || !result.translated_text.trim()) {
    throw serviceFailure("translation", "recognition");
  }
  return result;
}

export async function translateTexts(
  items: BatchTranslationItem[],
  targetLanguage: string,
  signal?: AbortSignal
): Promise<BatchTranslationResult> {
  if (items.length === 0) {
    return { target_language: targetLanguage, translations: [] };
  }

  let url: string;
  try { url = `${getPrescriptionApiBaseUrl()}/translate/batch`; } catch { throw serviceFailure("translation", "unavailable"); }
  const result = await requestServiceJson<BatchTranslationResult>(url, {
    items, target_language: targetLanguage,
  }, "translation", 30000, signal);
  if (!result || !Array.isArray(result.translations) || items.some(item => !result.translations.some(
    row => row && row.key === item.key && typeof row.translated_text === "string" && row.translated_text.trim(),
  ))) throw serviceFailure("translation", "recognition");
  return result;
}
