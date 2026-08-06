import os
import io
import re
import hashlib
import json
import sqlite3
import threading
import requests
import PIL.Image
import pandas as pd
from rapidfuzz import process, fuzz
from fastapi import FastAPI, HTTPException, Body, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from google import genai
from google.genai import types
from dotenv import load_dotenv

# 設定與初始化
load_dotenv()

# --- 設定 ---
app = FastAPI(title="Prescription OCR & Translation API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API KEY
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY environment variable is required. "
        "Set it before starting the backend."
    )
client = genai.Client(api_key=API_KEY)

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
TRANSLATION_MODEL = GEMINI_MODEL
TRANSLATION_CACHE_VERSION = "v1"
TRANSLATION_CACHE_PATH = os.getenv(
    "TRANSLATION_CACHE_PATH",
    os.path.join(os.path.dirname(__file__), "translation_cache.sqlite3"),
)
translation_cache_lock = threading.Lock()

def init_translation_cache() -> None:
    with sqlite3.connect(TRANSLATION_CACHE_PATH) as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS translations (
                cache_key TEXT PRIMARY KEY,
                source_text TEXT NOT NULL,
                target_language TEXT NOT NULL,
                translated_text TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"""
        )

def normalize_translation_text(text: str) -> str:
    return " ".join(text.strip().split())

def translation_cache_key(text: str, target_language: str) -> str:
    value = f"{TRANSLATION_CACHE_VERSION}\n{target_language.strip().lower()}\n{normalize_translation_text(text)}"
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

def get_cached_translation(text: str, target_language: str) -> Optional[str]:
    key = translation_cache_key(text, target_language)
    with translation_cache_lock, sqlite3.connect(TRANSLATION_CACHE_PATH) as conn:
        row = conn.execute(
            "SELECT translated_text FROM translations WHERE cache_key = ?", (key,)
        ).fetchone()
    return row[0] if row else None

def cache_translation(text: str, target_language: str, translated_text: str) -> None:
    key = translation_cache_key(text, target_language)
    with translation_cache_lock, sqlite3.connect(TRANSLATION_CACHE_PATH) as conn:
        conn.execute(
            """INSERT OR REPLACE INTO translations
               (cache_key, source_text, target_language, translated_text)
               VALUES (?, ?, ?, ?)""",
            (key, normalize_translation_text(text), target_language, translated_text),
        )

init_translation_cache()

# ===== 載入藥物外觀資料庫 =====

def load_drug_database(csv_path: str = "data.csv") -> pd.DataFrame:
    """載入藥物外觀 CSV，並分別建立中文與混合搜尋專用的索引欄位。"""
    try:
        df = pd.read_csv(csv_path)
        # 建立中文獨立索引（提升中文比對優先度與準確率）
        df["_zh_search_key"] = df["中文品名"].fillna("").str.strip().str.upper()
        # 建立中英混合索引
        df["_search_key"] = (
            df["中文品名"].fillna("") + " " + df["英文品名"].fillna("")
        ).str.strip().str.upper()
        return df
    except Exception as e:
        print(f"[WARNING] 無法載入藥物資料庫: {e}")
        return pd.DataFrame()

DRUG_DB = load_drug_database()

# ===== 藥物外觀資料結構與優先中文比對 =====

class DrugAppearance(BaseModel):
    shape: Optional[str] = Field(None, description="形狀")
    color: Optional[str] = Field(None, description="顏色")
    size_mm: Optional[str] = Field(None, description="外觀尺寸 (mm)")
    marking: Optional[str] = Field(None, description="錠面標註")
    special_form: Optional[str] = Field(None, description="特殊劑型")
    image_urls: List[str] = Field(default_factory=list, description="外觀圖檔網址清單")
    matched_name_zh: Optional[str] = Field(None, description="資料庫比對到的中文品名")
    matched_name_en: Optional[str] = Field(None, description="資料庫比對到的英文品名")
    match_score: Optional[float] = Field(None, description="比對相似度 (0–100)")

def lookup_drug_appearance(drug_name: str, score_cutoff: int = 60) -> Optional[DrugAppearance]:
    """
    僅用於向 CSV 資料庫查詢藥品外觀與圖片資訊。
    策略：優先提取藥名中的中文部分進行中文特化比對，若無中文或比對分數過低則降級至中英混合比對。
    """
    if DRUG_DB.empty or not drug_name:
        return None

    query_full = drug_name.strip().upper()
    
    # 嘗試提取藥名中的中文字元
    chinese_parts = "".join(re.findall(r'[\u4e00-\u9fa5]+', drug_name)).strip().upper()

    best_match = None
    
    # === 階段 1: 優先進行中文專用比對 ===
    if chinese_parts:
        zh_choices = DRUG_DB["_zh_search_key"].tolist()
        zh_result = process.extractOne(
            chinese_parts,
            zh_choices,
            scorer=fuzz.token_set_ratio,
            score_cutoff=score_cutoff,
        )
        if zh_result:
            matched_text, score, idx = zh_result
            best_match = (idx, score)

    # === 階段 2: 若無中文或中文比對未達門檻，改用全名稱混合比對 ===
    if not best_match:
        choices = DRUG_DB["_search_key"].tolist()
        full_result = process.extractOne(
            query_full,
            choices,
            scorer=fuzz.token_set_ratio,
            score_cutoff=score_cutoff,
        )
        if full_result:
            matched_text, score, idx = full_result
            best_match = (idx, score)

    if not best_match:
        return None

    idx, score = best_match
    row = DRUG_DB.iloc[idx]

    # 處理多圖（以 ;;; 分隔）
    raw_urls = str(row.get("外觀圖檔連結", "") or "")
    image_urls = [u.strip() for u in raw_urls.split(";;;") if u.strip() and u.strip() != "nan"]

    # 處理多顏色（以 ;;; 分隔）
    raw_color = str(row.get("顏色", "") or "")
    color = "、".join({c.strip() for c in raw_color.split(";;;") if c.strip() and c.strip() != "nan"})

    # 標註整合
    mark1 = str(row.get("標註一", "") or "").strip()
    mark2 = str(row.get("標註二", "") or "").strip()
    marking_parts = [m for m in [mark1, mark2] if m and m != "nan"]
    marking = " / ".join(marking_parts) if marking_parts else None

    size_raw = row.get("外觀尺寸", None)
    size_str = f"{size_raw} mm" if pd.notna(size_raw) else None

    special_form_raw = str(row.get("特殊劑型", "") or "").strip()
    special_form = special_form_raw if special_form_raw and special_form_raw != "nan" else None

    return DrugAppearance(
        shape=str(row.get("形狀", "") or "").strip() or None,
        color=color or None,
        size_mm=size_str,
        marking=marking,
        special_form=special_form,
        image_urls=image_urls,
        matched_name_zh=str(row.get("中文品名", "") or "").strip() or None,
        matched_name_en=str(row.get("英文品名", "") or "").strip() or None,
        match_score=score,
    )

# ===== 定義資料結構 =====

class MemoDetails(BaseModel):
    doctor_instructions: Optional[str] = Field(None, description="特定條件醫囑與用藥指示")
    precautions: Optional[str] = Field(None, description="注意事項、副作用與警語")
    refill_info: Optional[str] = Field(None, description="慢性病連續處方箋領藥相關資訊")
    other: Optional[str] = Field(None, description="其他非結構化文字備註")

class MedicineItem(BaseModel):
    drug_name: str = Field(..., description="藥單上記錄之藥品名稱 (維持藥單原始辨識結果)")
    dosage: Optional[str] = Field(None, description="劑量 (例如 5mg, 0.1%)")
    quantity: str = Field(..., description="數量 (例如 1瓶, 28顆)")
    usage_zh: str = Field(..., description="中文服用說明 (例如：每日三次，飯後)")
    common_uses: Optional[str] = Field(None, description="此藥品的常見臨床用途或適應症")
    appearance: Optional[DrugAppearance] = Field(None, description="藥品外觀與圖片資訊（來自衛福部藥物資料庫查詢）")

class PrescriptionResponse(BaseModel):
    clinic_name: str = Field(..., description="醫療機構/診所名稱（不含科別）")
    department: Optional[str] = Field(None, description="獨立醫療科別（如：耳鼻喉科、眼科）")
    visit_date: Optional[str] = Field(None, description="就診日期")
    patient_name: Optional[str] = Field(None, description="病患姓名")
    medicines: List[MedicineItem] = Field(..., description="藥品清單")
    memo: Optional[MemoDetails] = Field(None, description="結構化備註資訊")

# Gemini 解析用的內部結構
class _MedicineItemRaw(BaseModel):
    drug_name: str
    dosage: Optional[str] = None
    quantity: str
    usage_zh: str
    common_uses: Optional[str] = None

class _PrescriptionRaw(BaseModel):
    clinic_name: str
    department: Optional[str] = None
    visit_date: Optional[str] = None
    patient_name: Optional[str] = None
    medicines: List[_MedicineItemRaw]
    memo: Optional[MemoDetails] = None

class ImageUrlInput(BaseModel):
    image_url: str = Field(..., description="藥單圖片URL", example="https://example.jpg")

# ===== 翻譯用資料結構 =====

class TranslationRequest(BaseModel):
    text: str = Field(..., description="要翻譯的文字內容")
    target_language: Optional[str] = Field(
        None,
        description="目標語言（僅在來源為中文時需要指定）。"
    )

class TranslationResponse(BaseModel):
    detected_language: str = Field(..., description="偵測到的來源語言")
    target_language: str = Field(..., description="翻譯目標語言")
    original_text: str = Field(..., description="原始輸入文字")
    translated_text: str = Field(..., description="翻譯後的文字")

class TranslationResult(BaseModel):
    detected_language: str
    target_language: str
    translated_text: str

class BatchTranslationItem(BaseModel):
    key: str = Field(..., min_length=1, max_length=200)
    text: str = Field(..., min_length=1, max_length=10000)

class BatchTranslationRequest(BaseModel):
    items: List[BatchTranslationItem] = Field(..., min_length=1, max_length=100)
    target_language: str = Field(..., min_length=1, max_length=100)

class BatchTranslationOutput(BaseModel):
    key: str
    translated_text: str

class BatchTranslationModelResult(BaseModel):
    translations: List[BatchTranslationOutput]

class BatchTranslationResponseItem(BatchTranslationOutput):
    cached: bool

class BatchTranslationResponse(BaseModel):
    target_language: str
    translations: List[BatchTranslationResponseItem]

# ===== 藥單 OCR 處理 =====

def process_prescription_with_gemini(img: PIL.Image.Image) -> PrescriptionResponse:
    prompt = """
    你是一個專業的醫療輔助 AI。請分析這張台灣的藥單圖片。
    
    【任務目標】
    1. **OCR與辨識**：精準辨識藥單上印製的藥品名稱（drug_name）與用法，修正明顯的拼字錯字。請務必完整保留藥單上的原始藥名（不論中文或英文）。
    2. **資訊拆分與提取**：
       - **clinic_name**：僅填寫診所或醫院機構全稱。
       - **department**：明確拆分出醫療科別（如：「耳鼻喉科」、「胃腸肝膽科」、「眼科」）。若無則填 null。
    3. **common_uses**：根據藥品名稱與劑型，填寫常見臨床用途（繁體中文簡短說明，如「降血壓」）。
    4. **memo 結構化拆分**：將藥單上的備註、警語、慢籤等資訊，嚴格分類至對應欄位（doctor_instructions, precautions, refill_info, other）。
    
    【輸出限制】
    - 請直接回傳符合 JSON Schema 的資料。
    - 若欄位無法辨識或未提及，請填 null。
    """

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[prompt, img],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=_PrescriptionRaw,
            )
        )

        raw = _PrescriptionRaw.model_validate_json(response.text)

        enriched_medicines = []
        for med in raw.medicines:
            # 僅傳入藥單辨識藥名查詢外觀與圖片
            appearance = lookup_drug_appearance(med.drug_name)

            enriched_medicines.append(
                MedicineItem(
                    drug_name=med.drug_name,  # 嚴格輸出藥單上的藥名，不替換為資料庫名稱
                    dosage=med.dosage,
                    quantity=med.quantity,
                    usage_zh=med.usage_zh,
                    common_uses=med.common_uses,
                    appearance=appearance,     # 資料庫資訊僅作為外觀物件附件
                )
            )

        return PrescriptionResponse(
            clinic_name=raw.clinic_name,
            department=raw.department,
            visit_date=raw.visit_date,
            patient_name=raw.patient_name,
            medicines=enriched_medicines,
            memo=raw.memo,
        )

    except Exception as e:
        print(f"AI Processing Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI 解析失敗: {str(e)}")

# ===== 翻譯處理 =====

def process_translation_with_gemini(text: str, target_language: Optional[str]) -> TranslationResult:
    if target_language:
        cached = get_cached_translation(text, target_language)
        if cached:
            return TranslationResult(
                detected_language="cached",
                target_language=target_language,
                translated_text=cached,
            )

    target_hint = target_language if target_language else "Traditional Chinese"

    prompt = f"""
Translate the text to {target_hint}. Preserve drug names, dosages, units and numbers.
Detect the source language. Return only the requested JSON fields.
Text: {text}
"""

    try:
        response = client.models.generate_content(
            model=TRANSLATION_MODEL,
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=TranslationResult
            )
        )

        result = TranslationResult.model_validate_json(response.text)
        if target_language:
            cache_translation(text, target_language, result.translated_text)
        usage = getattr(response, "usage_metadata", None)
        print(f"[translation_usage] model={TRANSLATION_MODEL} usage={usage}")
        return result

    except Exception as e:
        print(f"Translation Error: {e}")
        raise HTTPException(status_code=500, detail=f"翻譯失敗: {str(e)}")

def process_batch_translation_with_gemini(
    items: List[BatchTranslationItem], target_language: str
) -> List[BatchTranslationResponseItem]:
    results = {}
    missing = []
    for item in items:
        cached = get_cached_translation(item.text, target_language)
        if cached is not None:
            results[item.key] = BatchTranslationResponseItem(
                key=item.key, translated_text=cached, cached=True
            )
        else:
            missing.append(item)

    if missing:
        payload = [{"key": item.key, "text": item.text} for item in missing]
        prompt = (
            f"Translate every item's text from Traditional Chinese to {target_language}. "
            "Preserve drug names, dosages, units and numbers. Keep each key unchanged. "
            f"Items: {json.dumps(payload, ensure_ascii=False)}"
        )
        response = client.models.generate_content(
            model=TRANSLATION_MODEL,
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=BatchTranslationModelResult,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        parsed = BatchTranslationModelResult.model_validate_json(response.text)
        source_by_key = {item.key: item.text for item in missing}
        for translated in parsed.translations:
            source = source_by_key.get(translated.key)
            if source is None:
                continue
            cache_translation(source, target_language, translated.translated_text)
            results[translated.key] = BatchTranslationResponseItem(
                key=translated.key,
                translated_text=translated.translated_text,
                cached=False,
            )
        usage = getattr(response, "usage_metadata", None)
        print(
            f"[translation_usage] model={TRANSLATION_MODEL} items={len(missing)} usage={usage}"
        )

    return [results[item.key] for item in items if item.key in results]

# ===== API Endpoints =====

@app.get("/")
def root():
    return {"message": "AI Prescription OCR & Translation Service is Running!"}

@app.post("/analyze/url", response_model=PrescriptionResponse)
def analyze_from_url(data: ImageUrlInput):
    try:
        print(f"Downloading image from: {data.image_url}")
        resp = requests.get(data.image_url, timeout=10)
        resp.raise_for_status()

        image = PIL.Image.open(io.BytesIO(resp.content))
        result = process_prescription_with_gemini(image)

        return result

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"無法下載圖片: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"伺服器內部錯誤: {str(e)}")

@app.post("/analyze/upload", response_model=PrescriptionResponse)
async def analyze_upload_file(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        image = PIL.Image.open(io.BytesIO(contents))
        result = process_prescription_with_gemini(image)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"檔案解析失敗: {str(e)}")

@app.post(
    "/translate",
    response_model=TranslationResponse,
    summary="智慧翻譯",
)
def translate_text(data: TranslationRequest):
    try:
        result = process_translation_with_gemini(data.text, data.target_language)

        return TranslationResponse(
            detected_language=result.detected_language,
            target_language=result.target_language,
            original_text=data.text,
            translated_text=result.translated_text,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"翻譯服務發生錯誤: {str(e)}")

@app.post(
    "/translate/batch",
    response_model=BatchTranslationResponse,
    summary="批次翻譯",
)
def translate_texts(data: BatchTranslationRequest):
    try:
        translations = process_batch_translation_with_gemini(
            data.items, data.target_language
        )
        if len(translations) != len(data.items):
            raise HTTPException(status_code=502, detail="AI 未回傳所有翻譯欄位")
        return BatchTranslationResponse(
            target_language=data.target_language,
            translations=translations,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批次翻譯服務發生錯誤: {str(e)}")