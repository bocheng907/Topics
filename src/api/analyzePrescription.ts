export interface AnalyzeResult {
  medicines: any[];   // 依你後端實際回傳結構再細分
  raw_text?: string;
}

export async function analyzePrescriptionByUrl(imageUrl: string): Promise<AnalyzeResult> {
  const response = await fetch(
    "http://123.195.84.227:8000/analyze/url",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: imageUrl, // ⚠️ 一定要這個 key
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI analyze failed: ${errorText}`);
  }

  return await response.json();
}
