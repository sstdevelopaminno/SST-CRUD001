# OCR Server (Self-hosted)

Example OCR service for Thai ID card extraction, compatible with this project's `/api/ocr/id-card` proxy route.

## Endpoint
- `POST /ocr/id-card`
- Content type: `multipart/form-data`
- Fields:
  - `id_card_front` (required image)
  - `id_card_back` (optional image)

## Response Shape
```json
{
  "ok": true,
  "data": {
    "full_name": "...",
    "id_card_number": "...",
    "id_card_address": "...",
    "raw_text_front": "...",
    "raw_text_back": "...",
    "confidence": 0.82
  }
}
```

## Run Locally
1. `cd ocr-server`
2. `npm install`
3. copy `.env.example` -> `.env`
4. `npm run start`

Server will run at `http://127.0.0.1:8000` by default.

## Connect To Next.js App
In project root `.env.local`:

```bash
OCR_SERVICE_URL=http://127.0.0.1:8000/ocr/id-card
# Optional auth
OCR_SERVICE_API_KEY=
OCR_SERVICE_API_KEY_HEADER=
```

If you set `OCR_API_KEY` in OCR server `.env`, set matching values in Next.js env.

## Notes
- Uses `tesseract.js` as baseline OCR engine (Thai + English)
- This is a starter service and should be improved for production accuracy (image pre-processing, better model, domain-specific parsing)
