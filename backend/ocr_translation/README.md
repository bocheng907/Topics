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
uvicorn main:app --host 127.0.0.1 --port 8080
```

Translations are cached in `translation_cache.sqlite3` by default. Set
`TRANSLATION_CACHE_PATH` to a persistent writable path in production so cached
translations survive deployments.

## Frontend Config

OCR, single translation and batch translation share one base URL. The current
temporary default is the user-approved legacy server `http://123.195.84.227:8080`.
This server does not verify the caller. Prescription image download URLs and
translation text are sent without encryption. The App does not send Firebase
login tokens or cookies to that HTTP server; other HTTP destinations are blocked.

For an authenticated server with a trusted TLS certificate, set an HTTPS base
URL when starting Expo or building the app. The App sends the current Firebase
user's ID token to HTTPS servers:

```dotenv
EXPO_PUBLIC_PRESCRIPTION_API_BASE_URL=https://your-ocr-domain.example
```

Keep `GEMINI_API_KEY` on the server. The authenticated backend in this folder
uses a private persistent `OCR_USAGE_DB` for per-user and service-wide quotas.
