import { NextResponse } from "next/server";

import { assertPermission } from "@/lib/auth/permissions";
import { extractOcrRecord, mapThaiIdCardOcrOutput } from "@/lib/id-card-ocr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const DEFAULT_OCR_TIMEOUT_MS = 20_000;

function createErrorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message,
    },
    { status },
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function isImageFile(value: unknown): value is File {
  return value instanceof File && value.size > 0;
}

function validateImage(file: File, fieldName: string) {
  if (!file.type.startsWith("image/")) {
    return `${fieldName} must be an image file`;
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return `${fieldName} must be 8MB or less`;
  }

  return "";
}

function getOcrTimeoutMs() {
  const rawValue = Number(process.env.OCR_SERVICE_TIMEOUT_MS);

  if (!Number.isFinite(rawValue)) {
    return DEFAULT_OCR_TIMEOUT_MS;
  }

  return Math.min(120_000, Math.max(3_000, Math.round(rawValue)));
}

function buildOcrHeaders() {
  const headers = new Headers();
  const apiKey = process.env.OCR_SERVICE_API_KEY?.trim();
  const apiKeyHeader = process.env.OCR_SERVICE_API_KEY_HEADER?.trim();

  if (!apiKey) {
    return headers;
  }

  if (apiKeyHeader) {
    headers.set(apiKeyHeader, apiKey);
  } else {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }

  return headers;
}

async function parseProviderPayload(response: Response): Promise<unknown> {
  const responseText = await response.text();

  if (!responseText.trim()) {
    return {};
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return {
      message: responseText.trim(),
    };
  }
}

function getProviderMessage(payload: unknown, fallbackMessage: string) {
  const direct = asRecord(payload);

  if (!direct) {
    return fallbackMessage;
  }

  const directMessageCandidates: unknown[] = [
    direct.message,
    direct.error_message,
    direct.detail,
    direct.error,
  ];

  for (const candidate of directMessageCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }

    const nested = asRecord(candidate);

    if (nested && typeof nested.message === "string" && nested.message.trim()) {
      return nested.message.trim();
    }
  }

  return fallbackMessage;
}

function getProviderName(serviceUrl: string) {
  try {
    const parsed = new URL(serviceUrl);
    return parsed.origin;
  } catch {
    return "custom-ocr";
  }
}

export async function POST(request: Request) {
  try {
    await assertPermission("sales:manage");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";

    if (message === "Unauthorized") {
      return createErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
    }

    return createErrorResponse(403, "FORBIDDEN", "Forbidden");
  }

  const ocrServiceUrl = process.env.OCR_SERVICE_URL?.trim();

  if (!ocrServiceUrl) {
    return createErrorResponse(500, "OCR_NOT_CONFIGURED", "OCR service is not configured");
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return createErrorResponse(400, "INVALID_REQUEST", "Invalid multipart form payload");
  }

  const idCardFront = formData.get("id_card_front");
  const idCardBack = formData.get("id_card_back");

  if (!isImageFile(idCardFront)) {
    return createErrorResponse(400, "MISSING_ID_CARD_FRONT", "id_card_front image is required");
  }

  if (idCardBack && !isImageFile(idCardBack)) {
    return createErrorResponse(400, "INVALID_ID_CARD_BACK", "id_card_back must be an image file");
  }

  const frontValidationMessage = validateImage(idCardFront, "id_card_front");

  if (frontValidationMessage) {
    return createErrorResponse(400, "INVALID_ID_CARD_FRONT", frontValidationMessage);
  }

  if (isImageFile(idCardBack)) {
    const backValidationMessage = validateImage(idCardBack, "id_card_back");

    if (backValidationMessage) {
      return createErrorResponse(400, "INVALID_ID_CARD_BACK", backValidationMessage);
    }
  }

  const providerFormData = new FormData();
  providerFormData.set("id_card_front", idCardFront);

  if (isImageFile(idCardBack)) {
    providerFormData.set("id_card_back", idCardBack);
  }

  const abortController = new AbortController();
  const timeoutMs = getOcrTimeoutMs();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  let providerResponse: Response;

  try {
    providerResponse = await fetch(ocrServiceUrl, {
      method: "POST",
      headers: buildOcrHeaders(),
      body: providerFormData,
      signal: abortController.signal,
      cache: "no-store",
    });
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      return createErrorResponse(504, "OCR_PROVIDER_TIMEOUT", "OCR provider request timed out");
    }

    return createErrorResponse(502, "OCR_PROVIDER_ERROR", "Unable to reach OCR provider");
  }

  clearTimeout(timeoutId);

  const providerPayload = await parseProviderPayload(providerResponse);

  if (!providerResponse.ok) {
    const providerMessage = getProviderMessage(providerPayload, "OCR provider request failed");
    const loweredProviderMessage = providerMessage.toLowerCase();

    if (
      providerResponse.status === 429 ||
      loweredProviderMessage.includes("quota") ||
      loweredProviderMessage.includes("rate limit")
    ) {
      return createErrorResponse(429, "OCR_QUOTA_EXCEEDED", providerMessage);
    }

    if (providerResponse.status === 408 || providerResponse.status === 504) {
      return createErrorResponse(504, "OCR_PROVIDER_TIMEOUT", providerMessage);
    }

    return createErrorResponse(502, "OCR_PROVIDER_ERROR", providerMessage);
  }

  const extractedRecord = extractOcrRecord(providerPayload);

  if (!extractedRecord) {
    return createErrorResponse(502, "OCR_PARSE_FAILED", "Unable to parse OCR provider response");
  }

  const mapped = mapThaiIdCardOcrOutput(extractedRecord);

  if (!mapped.full_name && !mapped.id_card_number && !mapped.id_card_address) {
    return createErrorResponse(422, "OCR_NO_DATA", "No data detected from ID image");
  }

  return NextResponse.json({
    ok: true,
    data: mapped,
    provider: {
      service: getProviderName(ocrServiceUrl),
    },
  });
}
