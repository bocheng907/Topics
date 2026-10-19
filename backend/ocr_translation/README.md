# OCR / Translation Backend

This folder contains the OCR / Translation FastAPI backend for prescription image analysis.

## Setup

Install the Python dependencies first:

```bash
pip install -r requirements.txt
```

## Run

Start the FastAPI server from this folder:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Translations are cached in `translation_cache.sqlite3` by default. Set
`TRANSLATION_CACHE_PATH` to a persistent writable path in production so cached
translations survive deployments.

## Frontend Config

The current app configuration uses the OCR server's plain-HTTP address in both
development and production. To switch to HTTPS in another environment, set the
public Expo value at build/start time:

```dotenv
EXPO_PUBLIC_PRESCRIPTION_API_BASE_URL=https://your-ocr-domain.example
```

The app rejects plain-HTTP endpoints unless
`extra.allowInsecurePrescriptionApi` is explicitly set to `true` in
`app.json`. That exception applies to both development and production builds
and is the project's permanent compatibility setting for the current OCR
server. Prescription data is sent without transport encryption. Do not put
`GEMINI_API_KEY` or any other secret in an `EXPO_PUBLIC_` value.
