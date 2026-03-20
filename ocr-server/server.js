const express = require("express");
const cors = require("cors");
const multer = require("multer");
const Tesseract = require("tesseract.js");
require("dotenv").config();

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

app.use(cors());

function normalizeThaiDigits(value) {
  return value.replace(/[\u0E50-\u0E59]/g, (digit) => String(digit.charCodeAt(0) - 0x0e50));
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function isAuthorized(req) {
  const expectedKey = (process.env.OCR_API_KEY || "").trim();

  if (!expectedKey) {
    return true;
  }

  const customHeader = (process.env.OCR_API_KEY_HEADER || "").trim().toLowerCase();

  if (customHeader) {
    const actual = String(req.headers[customHeader] || "").trim();
    return actual === expectedKey;
  }

  const authorization = String(req.headers.authorization || "").trim();

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return false;
  }

  return authorization.slice(7).trim() === expectedKey;
}

function collect13DigitCandidates(text) {
  const normalized = normalizeThaiDigits(text || "");
  const compact = normalized.replace(/[^0-9]/g, "");
  const candidates = [];

  if (compact.length >= 13) {
    for (let i = 0; i <= compact.length - 13; i += 1) {
      candidates.push(compact.slice(i, i + 13));
    }
  }

  return candidates;
}

function isValidThaiIdCardNumber(idCardNumber) {
  if (!/^\d{13}$/.test(idCardNumber)) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < 12; i += 1) {
    sum += Number(idCardNumber[i]) * (13 - i);
  }

  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === Number(idCardNumber[12]);
}

function extractIdCardNumber(text) {
  const candidates = collect13DigitCandidates(text);
  const valid = candidates.find((value) => isValidThaiIdCardNumber(value));

  if (valid) {
    return valid;
  }

  return candidates[0] || null;
}

function extractFullName(text) {
  const normalized = normalizeThaiDigits(text || "");
  const lines = normalized
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const titleLine = lines.find((line) => /^(นาย|นางสาว|นาง|Mr\.?|Mrs\.?|Ms\.?)\s+/i.test(line));

  if (titleLine) {
    return titleLine;
  }

  const nameLabelLine = lines.find((line) => /^(ชื่อ|name)[:\s]/i.test(line));

  if (nameLabelLine) {
    return nameLabelLine.replace(/^(ชื่อ|name)[:\s]*/i, "").trim() || null;
  }

  return null;
}

function extractAddress(backText, frontText) {
  const source = [backText, frontText].filter(Boolean).join("\n");

  if (!source) {
    return null;
  }

  const lines = source
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length >= 12);

  if (lines.length === 0) {
    return null;
  }

  const addressLine = lines.find((line) => /(ที่อยู่|เลขที่|ถ\.|ถนน|ต\.|อ\.|จ\.|แขวง|เขต|จังหวัด)/i.test(line));

  if (addressLine) {
    return addressLine;
  }

  return lines.sort((a, b) => b.length - a.length)[0] || null;
}

async function recognizeImage(buffer) {
  const language = (process.env.OCR_LANG || "tha+eng").trim();

  const result = await Tesseract.recognize(buffer, language, {
    logger: () => undefined,
  });

  const text = typeof result?.data?.text === "string" ? result.data.text : "";
  const confidence = Number.isFinite(result?.data?.confidence) ? result.data.confidence / 100 : null;

  return {
    text,
    confidence,
  };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post(
  "/ocr/id-card",
  upload.fields([
    { name: "id_card_front", maxCount: 1 },
    { name: "id_card_back", maxCount: 1 },
  ]),
  async (req, res) => {
    if (!isAuthorized(req)) {
      return res.status(401).json({
        ok: false,
        message: "Unauthorized OCR request",
      });
    }

    const files = req.files || {};
    const frontFile = Array.isArray(files.id_card_front) ? files.id_card_front[0] : null;
    const backFile = Array.isArray(files.id_card_back) ? files.id_card_back[0] : null;

    if (!frontFile) {
      return res.status(400).json({
        ok: false,
        message: "id_card_front image is required",
      });
    }

    try {
      const frontOcr = await recognizeImage(frontFile.buffer);
      const backOcr = backFile ? await recognizeImage(backFile.buffer) : { text: "", confidence: null };

      const fullName = extractFullName(frontOcr.text);
      const idCardNumber = extractIdCardNumber([frontOcr.text, backOcr.text].join("\n"));
      const idCardAddress = extractAddress(backOcr.text, frontOcr.text);

      const confidenceValues = [frontOcr.confidence, backOcr.confidence].filter((value) => typeof value === "number");
      const confidence =
        confidenceValues.length > 0
          ? Math.max(0, Math.min(1, confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length))
          : null;

      return res.json({
        ok: true,
        data: {
          full_name: fullName,
          id_card_number: idCardNumber,
          id_card_address: idCardAddress,
          raw_text_front: frontOcr.text || null,
          raw_text_back: backOcr.text || null,
          confidence,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "OCR processing failed";
      return res.status(500).json({
        ok: false,
        message,
      });
    }
  },
);

const port = Number(process.env.PORT || 8000);

app.listen(port, () => {
  console.log(`OCR server is running on port ${port}`);
});
