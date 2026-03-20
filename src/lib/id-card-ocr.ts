export interface ThaiIdCardMappedResult {
  full_name: string | null;
  id_card_number: string | null;
  id_card_address: string | null;
  confidence: number | null;
  raw_text_front: string | null;
  raw_text_back: string | null;
}

function normalizeDigits(value: string) {
  return value.replace(/[\u0E50-\u0E59]/g, (digit) => String(digit.charCodeAt(0) - 0x0e50));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function pickFirstString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function normalizeName(value: string) {
  if (!value) {
    return "";
  }

  return normalizeWhitespace(
    value
      .replace(/\b(full[_\s-]?name|name|name\s*surname)\b[:\s]*/gi, "")
      .replace(/^[,\-\s]+/, ""),
  );
}

function normalizeAddress(value: string) {
  if (!value) {
    return "";
  }

  return normalizeWhitespace(
    value
      .replace(/\b(id[_\s-]?card[_\s-]?address|registered[_\s-]?address|address)\b[:\s]*/gi, "")
      .replace(/^[,\-\s]+/, ""),
  );
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start < 0 || end < 0 || end <= start) {
    return null;
  }

  return text.slice(start, end + 1);
}

function parsePossibleJson(text: string): Record<string, unknown> | null {
  const direct = text.trim();

  try {
    const parsed = JSON.parse(direct);
    return asRecord(parsed);
  } catch {
    const extracted = extractJsonObject(direct);

    if (!extracted) {
      return null;
    }

    try {
      const parsed = JSON.parse(extracted);
      return asRecord(parsed);
    } catch {
      return null;
    }
  }
}

function collect13DigitCandidates(values: string[]) {
  const candidates: string[] = [];

  for (const value of values) {
    if (!value) {
      continue;
    }

    const normalized = normalizeDigits(value);
    const compact = normalized.replace(/[^0-9]/g, "");

    if (compact.length >= 13) {
      for (let index = 0; index <= compact.length - 13; index += 1) {
        candidates.push(compact.slice(index, index + 13));
      }
    }

    const groupedMatches = normalized.match(/\d[\d\s-]{11,25}\d/g) ?? [];

    for (const grouped of groupedMatches) {
      const groupedCompact = grouped.replace(/[^0-9]/g, "");

      if (groupedCompact.length >= 13) {
        for (let index = 0; index <= groupedCompact.length - 13; index += 1) {
          candidates.push(groupedCompact.slice(index, index + 13));
        }
      }
    }
  }

  return candidates;
}

function isValidThaiIdCardNumber(idCardNumber: string) {
  if (!/^\d{13}$/.test(idCardNumber)) {
    return false;
  }

  let sum = 0;

  for (let index = 0; index < 12; index += 1) {
    sum += Number(idCardNumber[index]) * (13 - index);
  }

  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === Number(idCardNumber[12]);
}

function pickThaiIdCardNumber(values: string[]) {
  const candidates = collect13DigitCandidates(values);
  const valid = candidates.find((candidate) => isValidThaiIdCardNumber(candidate));

  if (valid) {
    return valid;
  }

  return candidates[0] ?? "";
}

function extractAddressFromRawText(rawText: string) {
  if (!rawText) {
    return "";
  }

  const normalizedLines = rawText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length >= 15);

  if (normalizedLines.length === 0) {
    return "";
  }

  const bestLine = [...normalizedLines].sort((left, right) => right.length - left.length)[0];
  return normalizeAddress(bestLine);
}

function mapPayloadToResult(payload: Record<string, unknown>): ThaiIdCardMappedResult {
  const rawTextFront = pickFirstString(payload, ["raw_text_front", "rawTextFront", "ocr_text_front", "text_front", "front_text"]);
  const rawTextBack = pickFirstString(payload, ["raw_text_back", "rawTextBack", "ocr_text_back", "text_back", "back_text"]);
  const joinedRaw = normalizeWhitespace([rawTextFront, rawTextBack].filter(Boolean).join("\n"));

  const title = pickFirstString(payload, ["title", "name_title", "prefix"]);
  const firstName = pickFirstString(payload, ["first_name", "firstName", "given_name", "givenName"]);
  const lastName = pickFirstString(payload, ["last_name", "lastName", "surname"]);

  const fieldName = pickFirstString(payload, ["full_name", "fullName", "name", "th_name", "thai_name"]);
  const composedName = normalizeName([title, firstName, lastName].filter(Boolean).join(" "));
  const fullName = normalizeName(fieldName || composedName);

  const idCardNumber = pickThaiIdCardNumber([
    pickFirstString(payload, ["id_card_number", "idCardNumber", "national_id", "nationalId", "citizen_id", "citizenId"]),
    rawTextFront,
    rawTextBack,
    joinedRaw,
  ]);

  const idCardAddress = normalizeAddress(
    pickFirstString(payload, ["id_card_address", "idCardAddress", "address", "registered_address", "registeredAddress"]) ||
      extractAddressFromRawText(rawTextBack || rawTextFront || joinedRaw),
  );

  const confidenceValue = payload.confidence;
  const confidence = typeof confidenceValue === "number" && Number.isFinite(confidenceValue)
    ? Math.min(1, Math.max(0, confidenceValue))
    : null;

  return {
    full_name: fullName || null,
    id_card_number: idCardNumber || null,
    id_card_address: idCardAddress || null,
    confidence,
    raw_text_front: rawTextFront || null,
    raw_text_back: rawTextBack || null,
  };
}

function parseContentToRecord(content: unknown): Record<string, unknown> | null {
  if (typeof content === "string") {
    return parsePossibleJson(content);
  }

  if (Array.isArray(content)) {
    for (const item of content) {
      const itemRecord = asRecord(item);

      if (!itemRecord) {
        continue;
      }

      const textValue =
        typeof itemRecord.text === "string" ? itemRecord.text : typeof itemRecord.content === "string" ? itemRecord.content : "";

      if (!textValue) {
        continue;
      }

      const parsed = parsePossibleJson(textValue);

      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  return null;
}

const LIKELY_OCR_KEYS = [
  "full_name",
  "fullName",
  "name",
  "th_name",
  "thai_name",
  "title",
  "first_name",
  "firstName",
  "last_name",
  "lastName",
  "surname",
  "id_card_number",
  "idCardNumber",
  "national_id",
  "nationalId",
  "citizen_id",
  "citizenId",
  "id_card_address",
  "idCardAddress",
  "address",
  "registered_address",
  "registeredAddress",
  "raw_text_front",
  "raw_text_back",
  "text_front",
  "text_back",
  "ocr_text_front",
  "ocr_text_back",
  "confidence",
];

function hasLikelyOcrKeys(payload: Record<string, unknown>) {
  return LIKELY_OCR_KEYS.some((key) => key in payload);
}

export function parseOpenAiContentToRecord(content: unknown): Record<string, unknown> | null {
  return parseContentToRecord(content);
}

export function extractOcrRecord(payload: unknown): Record<string, unknown> | null {
  const direct = asRecord(payload);

  if (!direct) {
    return parseContentToRecord(payload);
  }

  if (hasLikelyOcrKeys(direct)) {
    return direct;
  }

  const nestedKeys = ["data", "result", "output", "ocr", "payload", "document", "id_card"];

  for (const key of nestedKeys) {
    const nestedValue = direct[key];
    const nestedRecord = asRecord(nestedValue);

    if (nestedRecord) {
      const parsedNested = extractOcrRecord(nestedRecord);

      if (parsedNested) {
        return parsedNested;
      }
    }

    const parsedContent = parseContentToRecord(nestedValue);

    if (parsedContent) {
      return parsedContent;
    }
  }

  for (const value of Object.values(direct)) {
    const nestedRecord = asRecord(value);

    if (nestedRecord && hasLikelyOcrKeys(nestedRecord)) {
      return nestedRecord;
    }
  }

  return null;
}

export function mapThaiIdCardOcrOutput(input: unknown): ThaiIdCardMappedResult {
  const record = asRecord(input);

  if (!record) {
    return {
      full_name: null,
      id_card_number: null,
      id_card_address: null,
      confidence: null,
      raw_text_front: null,
      raw_text_back: null,
    };
  }

  return mapPayloadToResult(record);
}
