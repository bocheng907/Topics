import Constants from "expo-constants";

export interface AnalyzeResult {
  medicines: any[];
  raw_text?: string;
}

function getPrescriptionAnalyzeUrl() {
  const baseUrl = Constants.expoConfig?.extra?.prescriptionApiBaseUrl;

  if (typeof baseUrl !== "string" || !baseUrl.trim()) {
    throw new Error(
      "Missing Expo config: expo.extra.prescriptionApiBaseUrl is not set"
    );
  }

  return `${baseUrl.replace(/\/+$/, "")}/analyze/url`;
}

export async function analyzePrescriptionByUrl(imageUrl: string): Promise<AnalyzeResult> {
  let response: Response;

  try {
    response = await fetch(getPrescriptionAnalyzeUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl }),
    });
  } catch (err: any) {
    // 這裡抓到的通常就是 ATS / 連線層問題
    throw new Error(`Network request failed: ${String(err?.message ?? err)}`);
  }

  const text = await response.text(); // 先拿原始內容，避免 json() 把線索吃掉

  if (!response.ok) {
    throw new Error(`AI analyze failed (${response.status}): ${text}`);
  }

  try {
    return JSON.parse(text) as AnalyzeResult;
  } catch {
    throw new Error(`AI analyze returned non-JSON: ${text}`);
  }
}
