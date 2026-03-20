"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ClipboardList, Coins, ListChecks, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import {
  createSalesCommissionCycleAction,
  createSalesProfileAction,
  deleteSalesProfileAction,
  getSalesCommissionCyclesPageAction,
  getSalesProfilesPageAction,
  updateSalesCommissionCycleStatusAction,
  updateSalesProfileAction,
} from "@/app/actions/sales-team";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { PaginatedResult, SalesCommissionCycleItem, SalesOption, SalesProfileItem } from "@/services/sales-team.service";

interface SalesTeamClientProps {
  initialProfilePage: PaginatedResult<SalesProfileItem>;
  initialCyclePage: PaginatedResult<SalesCommissionCycleItem>;
  profileOptions: SalesOption[];
  staffUsers: SalesOption[];
  managers: SalesOption[];
  locale: string;
}

const NONE_OPTION = "__none__";
const MODAL_ANIMATION_MS = 260;
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

type SalesTeamModalType = "add-sales" | "sales-list" | "commission" | "commission-list" | null;
type CycleStatusAction = "submitted" | "approved" | "rejected" | "paid";
type SalesProfileStatus = "active" | "inactive" | "suspended";

interface SalesProfileDraft {
  fullName: string;
  employeeCode: string;
  phone: string;
  userId: string;
  managerId: string;
  status: SalesProfileStatus;
}

interface IdCardScanResponse {
  full_name?: string;
  fullName?: string;
  id_card_number?: string;
  idCardNumber?: string;
  id_card_address?: string;
  idCardAddress?: string;
}

const MAX_ID_CARD_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_ID_CARD_UPLOAD_BYTES = 1_900_000;
const MAX_ID_CARD_UPLOAD_DIMENSION = 2200;
const JPEG_QUALITY_STEPS = [0.92, 0.84, 0.76, 0.68, 0.6];
const MIN_ID_CARD_WIDTH = 1100;
const MIN_ID_CARD_HEIGHT = 680;
const ID_CARD_TARGET_ASPECT_RATIO = 85.6 / 53.98;
const ID_CARD_ASPECT_TOLERANCE = 0.22;
const MIN_ID_CARD_SHARPNESS = 42;
const OCR_ENABLED = process.env.NEXT_PUBLIC_OCR_ENABLED === "true";

type IdCardFrontQualityCode = "too_large" | "too_small" | "bad_aspect_ratio" | "too_blurry" | "invalid_image";

interface IdCardFrontQualityResult {
  ok: boolean;
  code?: IdCardFrontQualityCode;
}

function computeLaplacianVariance(image: HTMLImageElement) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return 0;
  }

  const maxSampleWidth = 820;
  const scale = Math.min(1, maxSampleWidth / sourceWidth);
  const width = Math.max(64, Math.round(sourceWidth * scale));
  const height = Math.max(64, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return 0;
  }

  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const gray = new Float32Array(width * height);

  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    gray[i] = 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2];
  }

  let sum = 0;
  let sumSquares = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const center = gray[index];
      const north = gray[index - width];
      const south = gray[index + width];
      const east = gray[index + 1];
      const west = gray[index - 1];
      const laplacian = 4 * center - north - south - east - west;

      sum += laplacian;
      sumSquares += laplacian * laplacian;
      count += 1;
    }
  }

  if (count === 0) {
    return 0;
  }

  const mean = sum / count;
  return sumSquares / count - mean * mean;
}

async function analyzeIdCardFrontImageQuality(file: File): Promise<IdCardFrontQualityResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, code: "invalid_image" };
  }

  if (file.size > MAX_ID_CARD_IMAGE_BYTES) {
    return { ok: false, code: "too_large" };
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("invalid image"));
      element.src = objectUrl;
    });

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    if (width < MIN_ID_CARD_WIDTH || height < MIN_ID_CARD_HEIGHT) {
      return { ok: false, code: "too_small" };
    }

    const ratio = width / height;
    const minRatio = ID_CARD_TARGET_ASPECT_RATIO * (1 - ID_CARD_ASPECT_TOLERANCE);
    const maxRatio = ID_CARD_TARGET_ASPECT_RATIO * (1 + ID_CARD_ASPECT_TOLERANCE);

    if (ratio < minRatio || ratio > maxRatio) {
      return { ok: false, code: "bad_aspect_ratio" };
    }

    const sharpness = computeLaplacianVariance(image);

    if (sharpness < MIN_ID_CARD_SHARPNESS) {
      return { ok: false, code: "too_blurry" };
    }

    return { ok: true };
  } catch {
    return { ok: false, code: "invalid_image" };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function optimizeFileName(fileName: string) {
  const nameWithoutExtension = fileName.replace(/\.[^.]+$/, "");
  const safeBase = nameWithoutExtension.trim() || "id-card-front";
  return `${safeBase}-optimized.jpg`;
}

function convertCanvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

async function optimizeIdCardImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  if (file.size <= MAX_ID_CARD_UPLOAD_BYTES) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("invalid image"));
      element.src = objectUrl;
    });

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error("invalid image dimensions");
    }

    const maxDimension = Math.max(sourceWidth, sourceHeight);
    const initialScale = Math.min(1, MAX_ID_CARD_UPLOAD_DIMENSION / maxDimension);
    let width = Math.max(MIN_ID_CARD_WIDTH, Math.round(sourceWidth * initialScale));
    let height = Math.max(MIN_ID_CARD_HEIGHT, Math.round(sourceHeight * initialScale));

    let smallestBlob: Blob | null = null;

    while (width >= MIN_ID_CARD_WIDTH && height >= MIN_ID_CARD_HEIGHT) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("cannot create canvas context");
      }

      context.drawImage(image, 0, 0, width, height);

      for (const quality of JPEG_QUALITY_STEPS) {
        const blob = await convertCanvasToBlob(canvas, quality);

        if (!blob) {
          continue;
        }

        if (!smallestBlob || blob.size < smallestBlob.size) {
          smallestBlob = blob;
        }

        if (blob.size <= MAX_ID_CARD_UPLOAD_BYTES) {
          return new File([blob], optimizeFileName(file.name), {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
        }
      }

      if (width === MIN_ID_CARD_WIDTH && height === MIN_ID_CARD_HEIGHT) {
        break;
      }

      const nextWidth = Math.max(MIN_ID_CARD_WIDTH, Math.round(width * 0.88));
      const nextHeight = Math.max(MIN_ID_CARD_HEIGHT, Math.round(height * 0.88));

      if (nextWidth === width && nextHeight === height) {
        break;
      }

      width = nextWidth;
      height = nextHeight;
    }

    if (smallestBlob && smallestBlob.size <= MAX_ID_CARD_UPLOAD_BYTES) {
      return new File([smallestBlob], optimizeFileName(file.name), {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    }

    throw new Error("cannot optimize image size");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
function useDebouncedValue<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function statusBadgeVariant(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "approved" || normalized === "paid" || normalized === "active") return "success" as const;
  if (normalized === "submitted" || normalized === "draft" || normalized === "pending") return "warning" as const;
  return "outline" as const;
}

function cycleStatusLabel(status: string, locale: string) {
  const normalized = status.toLowerCase();

  if (locale === "th") {
    if (normalized === "draft") return "ฉบับร่าง";
    if (normalized === "submitted") return "ส่งพิจารณา";
    if (normalized === "approved") return "อนุมัติแล้ว";
    if (normalized === "rejected") return "ไม่อนุมัติ";
    if (normalized === "paid") return "จ่ายแล้ว";
  }

  if (normalized === "draft") return "Draft";
  if (normalized === "submitted") return "Submitted";
  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "paid") return "Paid";
  return status;
}

function normalizeDisplayText(value: string | null | undefined) {
  if (!value || value === "-") {
    return "";
  }

  return value;
}

function toProfileStatus(value: string): SalesProfileStatus {
  if (value === "inactive" || value === "suspended") {
    return value;
  }

  return "active";
}

function mergeProfileOptions(existing: SalesOption[], incoming: SalesOption[]) {
  const optionMap = new Map<string, string>();

  for (const option of existing) {
    optionMap.set(option.id, option.name);
  }

  for (const option of incoming) {
    optionMap.set(option.id, option.name);
  }

  return Array.from(optionMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function SalesTeamClient({ initialProfilePage, initialCyclePage, profileOptions: initialProfileOptions, staffUsers, managers, locale }: SalesTeamClientProps) {
  const [pending, startTransition] = useTransition();

  const [profiles, setProfiles] = useState(initialProfilePage.items);
  const [profileOptions, setProfileOptions] = useState(initialProfileOptions);
  const [profilesLoading, setProfilesLoading] = useState(false);

  const [cycles, setCycles] = useState(initialCyclePage.items);
  const [cyclesLoading, setCyclesLoading] = useState(false);
  const [processingCycleId, setProcessingCycleId] = useState<string | null>(null);

  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState<SalesProfileDraft | null>(null);
  const [profileSavingId, setProfileSavingId] = useState<string | null>(null);
  const [profileDeletingId, setProfileDeletingId] = useState<string | null>(null);

  const [activeModal, setActiveModal] = useState<SalesTeamModalType>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const modalCloseTimerRef = useRef<number | null>(null);

  const [profileSearch, setProfileSearch] = useState("");
  const [profilePage, setProfilePage] = useState(1);
  const [profilePageSize, setProfilePageSize] = useState(initialProfilePage.pageSize);
  const [profileCursor, setProfileCursor] = useState<string | null>(null);
  const [profileCursorHistory, setProfileCursorHistory] = useState<Array<string | null>>([]);
  const [profileHasNext, setProfileHasNext] = useState(initialProfilePage.hasNext);
  const [profileNextCursor, setProfileNextCursor] = useState<string | null>(initialProfilePage.nextCursor);

  const [cycleSearch, setCycleSearch] = useState("");
  const [cyclePage, setCyclePage] = useState(1);
  const [cyclePageSize, setCyclePageSize] = useState(initialCyclePage.pageSize);
  const [cycleCursor, setCycleCursor] = useState<string | null>(null);
  const [cycleCursorHistory, setCycleCursorHistory] = useState<Array<string | null>>([]);
  const [cycleHasNext, setCycleHasNext] = useState(initialCyclePage.hasNext);
  const [cycleNextCursor, setCycleNextCursor] = useState<string | null>(initialCyclePage.nextCursor);

  const labels =
    locale === "th"
      ? {
          title: "เพิ่มฝ่ายขายและจัดการประวัติ",
          description: "เก็บข้อมูลพนักงานขาย เอกสารบัตร และ workflow คอมมิชชั่นรายเดือน",
          profileTitle: "เพิ่มพนักงานฝ่ายขาย",
          profileDescription: "\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e0a\u0e37\u0e48\u0e2d \u0e40\u0e1a\u0e2d\u0e23\u0e4c\u0e15\u0e34\u0e14\u0e15\u0e48\u0e2d \u0e41\u0e25\u0e30\u0e2a\u0e41\u0e01\u0e19\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01\u0e1a\u0e31\u0e15\u0e23\u0e1b\u0e23\u0e30\u0e0a\u0e32\u0e0a\u0e19",
          fullName: "ชื่อ-นามสกุล",
          employeeCode: "รหัสพนักงาน",
          phone: "เบอร์โทร",
          userAccount: "ผูกกับผู้ใช้ระบบ",
          manager: "หัวหน้าที่ดูแล",
          currentAddress: "ที่อยู่ปัจจุบัน",
          idCardAddress: "ที่อยู่ตามบัตร",
          idCardNumber: "เลขบัตรประชาชน",
          notes: "หมายเหตุ",
          startDate: "วันที่เริ่มงาน",
          status: "สถานะ",
          portrait: "รูปหน้าตรง",
          idCardFront: "บัตรประชาชนด้านหน้า",
          idCardBack: "\u0e41\u0e2a\u0e14\u0e07\u0e23\u0e39\u0e1b\u0e1a\u0e31\u0e15\u0e23\u0e1b\u0e23\u0e30\u0e0a\u0e32\u0e0a\u0e19",
          idScanTitle: "\u0e2a\u0e41\u0e01\u0e19\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01\u0e1a\u0e31\u0e15\u0e23\u0e1b\u0e23\u0e30\u0e0a\u0e32\u0e0a\u0e19",
          idScanDescription: "\u0e2d\u0e31\u0e1b\u0e42\u0e2b\u0e25\u0e14\u0e23\u0e39\u0e1b\u0e1a\u0e31\u0e15\u0e23 \u0e41\u0e25\u0e49\u0e27\u0e43\u0e2b\u0e49\u0e23\u0e30\u0e1a\u0e1a\u0e40\u0e15\u0e34\u0e21\u0e0a\u0e37\u0e48\u0e2d \u0e40\u0e25\u0e02\u0e1a\u0e31\u0e15\u0e23 \u0e41\u0e25\u0e30\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48\u0e15\u0e32\u0e21\u0e1a\u0e31\u0e15\u0e23\u0e43\u0e2b\u0e49\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34",
          scanIdCard: "\u0e2a\u0e41\u0e01\u0e19\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25",
          scanInProgress: "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e2a\u0e41\u0e01\u0e19...",
          scanNoFront: "\u0e01\u0e23\u0e38\u0e13\u0e32\u0e2d\u0e31\u0e1b\u0e42\u0e2b\u0e25\u0e14\u0e23\u0e39\u0e1b\u0e1a\u0e31\u0e15\u0e23\u0e14\u0e49\u0e32\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e01\u0e48\u0e2d\u0e19\u0e2a\u0e41\u0e01\u0e19",
          scanNotConfigured: "\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32 OCR service",
          scanNoData: "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01\u0e20\u0e32\u0e1e\u0e1a\u0e31\u0e15\u0e23",
          scanFailed: "\u0e2a\u0e41\u0e01\u0e19\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08",
          scanSuccess: "\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01\u0e1a\u0e31\u0e15\u0e23\u0e40\u0e23\u0e35\u0e22\u0e1a\u0e23\u0e49\u0e2d\u0e22",
          scanQuotaExceeded: "\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23 OCR \u0e16\u0e39\u0e01\u0e08\u0e33\u0e01\u0e31\u0e14\u0e42\u0e04\u0e27\u0e15\u0e49\u0e32/\u0e2d\u0e31\u0e15\u0e23\u0e32 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a OCR server",
          scanManualFallback:
            "\u0e0a\u0e37\u0e48\u0e2d \u0e40\u0e25\u0e02\u0e1a\u0e31\u0e15\u0e23 \u0e41\u0e25\u0e30\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48\u0e15\u0e32\u0e21\u0e1a\u0e31\u0e15\u0e23 \u0e08\u0e30\u0e16\u0e39\u0e01\u0e25\u0e47\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e1c\u0e25\u0e2a\u0e41\u0e01\u0e19 \u0e01\u0e23\u0e2d\u0e01\u0e40\u0e2d\u0e07\u0e44\u0e14\u0e49\u0e40\u0e09\u0e1e\u0e32\u0e30\u0e40\u0e1a\u0e2d\u0e23\u0e4c\u0e15\u0e34\u0e14\u0e15\u0e48\u0e2d \u0e41\u0e25\u0e30\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48\u0e1b\u0e31\u0e08\u0e08\u0e38\u0e1a\u0e31\u0e19",
          scanTemporarilyDisabled: "\u0e42\u0e2b\u0e21\u0e14\u0e2a\u0e41\u0e01\u0e19\u0e16\u0e39\u0e01\u0e1b\u0e34\u0e14\u0e0a\u0e31\u0e48\u0e27\u0e04\u0e23\u0e32\u0e27 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e1a\u0e31\u0e15\u0e23\u0e14\u0e49\u0e27\u0e22\u0e15\u0e19\u0e40\u0e2d\u0e07",
          manualIdentityRequired: "\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e0a\u0e37\u0e48\u0e2d \u0e40\u0e25\u0e02\u0e1a\u0e31\u0e15\u0e23\u0e1b\u0e23\u0e30\u0e0a\u0e32\u0e0a\u0e19 13 \u0e2b\u0e25\u0e31\u0e01 \u0e41\u0e25\u0e30\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48\u0e15\u0e32\u0e21\u0e1a\u0e31\u0e15\u0e23\u0e43\u0e2b\u0e49\u0e04\u0e23\u0e1a\u0e01\u0e48\u0e2d\u0e19\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01",
          phoneRequired: "\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e40\u0e1a\u0e2d\u0e23\u0e4c\u0e15\u0e34\u0e14\u0e15\u0e48\u0e2d",
          currentAddressRequired: "\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48\u0e1b\u0e31\u0e08\u0e08\u0e38\u0e1a\u0e31\u0e19",
          scanRequiredBeforeSave: "\u0e15\u0e49\u0e2d\u0e07\u0e2a\u0e41\u0e01\u0e19\u0e43\u0e2b\u0e49\u0e44\u0e14\u0e49\u0e04\u0e23\u0e1a \u0e0a\u0e37\u0e48\u0e2d \u0e40\u0e25\u0e02\u0e1a\u0e31\u0e15\u0e23 \u0e41\u0e25\u0e30\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48\u0e15\u0e32\u0e21\u0e1a\u0e31\u0e15\u0e23 \u0e01\u0e48\u0e2d\u0e19\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01",
          scanQualityRequirement: "\u0e15\u0e49\u0e2d\u0e07\u0e43\u0e0a\u0e49\u0e23\u0e39\u0e1b\u0e1a\u0e31\u0e15\u0e23\u0e14\u0e49\u0e32\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48\u0e04\u0e21\u0e0a\u0e31\u0e14 \u0e41\u0e25\u0e30\u0e40\u0e2b\u0e47\u0e19\u0e1a\u0e31\u0e15\u0e23\u0e40\u0e15\u0e47\u0e21\u0e43\u0e1a\u0e01\u0e48\u0e2d\u0e19\u0e2a\u0e41\u0e01\u0e19",
          scanQualityChecking: "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e15\u0e23\u0e27\u0e08\u0e04\u0e38\u0e13\u0e20\u0e32\u0e1e\u0e23\u0e39\u0e1b...",
          scanImageOptimizing: "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e1a\u0e35\u0e1a\u0e2d\u0e31\u0e14\u0e23\u0e39\u0e1b\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e2d\u0e31\u0e1b\u0e42\u0e2b\u0e25\u0e14...",
          scanCompressionFailed: "\u0e23\u0e39\u0e1b\u0e22\u0e31\u0e07\u0e43\u0e2b\u0e0d\u0e48\u0e40\u0e01\u0e34\u0e19\u0e25\u0e34\u0e21\u0e34\u0e15\u0e2d\u0e31\u0e1b\u0e42\u0e2b\u0e25\u0e14 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e16\u0e48\u0e32\u0e22\u0e43\u0e2b\u0e21\u0e48\u0e43\u0e2b\u0e49\u0e43\u0e01\u0e25\u0e49\u0e02\u0e36\u0e49\u0e19\u0e41\u0e25\u0e30\u0e43\u0e0a\u0e49\u0e44\u0e1f\u0e2a\u0e27\u0e48\u0e32\u0e07\u0e17\u0e35\u0e48\u0e14\u0e35",
          scanQualityTooLarge: "\u0e44\u0e1f\u0e25\u0e4c\u0e23\u0e39\u0e1b\u0e43\u0e2b\u0e0d\u0e48\u0e40\u0e01\u0e34\u0e19 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e43\u0e0a\u0e49\u0e23\u0e39\u0e1b\u0e44\u0e21\u0e48\u0e40\u0e01\u0e34\u0e19 8MB",
          scanQualityTooSmall: "\u0e04\u0e27\u0e32\u0e21\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e23\u0e39\u0e1b\u0e15\u0e48\u0e33\u0e40\u0e01\u0e34\u0e19\u0e44\u0e1b \u0e01\u0e23\u0e38\u0e13\u0e32\u0e16\u0e48\u0e32\u0e22\u0e43\u0e2b\u0e49\u0e0a\u0e31\u0e14\u0e41\u0e25\u0e30\u0e43\u0e01\u0e25\u0e49\u0e02\u0e36\u0e49\u0e19",
          scanQualityAspect: "\u0e20\u0e32\u0e1e\u0e1a\u0e31\u0e15\u0e23\u0e44\u0e21\u0e48\u0e40\u0e15\u0e47\u0e21\u0e43\u0e1a \u0e01\u0e23\u0e38\u0e13\u0e32\u0e08\u0e31\u0e14\u0e43\u0e2b\u0e49\u0e40\u0e2b\u0e47\u0e19\u0e17\u0e31\u0e49\u0e07 4 \u0e21\u0e38\u0e21\u0e02\u0e2d\u0e07\u0e1a\u0e31\u0e15\u0e23",
          scanQualityTooBlurry: "\u0e20\u0e32\u0e1e\u0e1a\u0e31\u0e15\u0e23\u0e44\u0e21\u0e48\u0e04\u0e21\u0e0a\u0e31\u0e14 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e16\u0e48\u0e32\u0e22\u0e43\u0e2b\u0e21\u0e48\u0e43\u0e19\u0e17\u0e35\u0e48\u0e41\u0e2a\u0e07\u0e40\u0e1e\u0e35\u0e22\u0e07\u0e1e\u0e2d",
          addSales: "บันทึกพนักงานฝ่ายขาย",
          profileListTitle: "รายชื่อฝ่ายขาย",
          profileListDescription: "ดูข้อมูลติดต่อและจำนวนเอกสารที่อัปโหลด",
          cycleTitle: "Workflow ค่าคอมมิชชั่นรายเดือน",
          cycleDescription: "สร้างรอบเดือน ส่งอนุมัติ อนุมัติ/ไม่อนุมัติ และปิดสถานะจ่ายเงิน",
          cycleProfile: "ฝ่ายขาย",
          cycleLabel: "ชื่อรอบ",
          periodStart: "เริ่มรอบ",
          periodEnd: "สิ้นสุดรอบ",
          commissionAmount: "จำนวนเงินคอม",
          actions: "การทำงาน",
          submit: "ส่งพิจารณา",
          approve: "อนุมัติ",
          reject: "ไม่อนุมัติ",
          paid: "ทำเครื่องหมายจ่ายแล้ว",
          documents: "เอกสาร",
          createCycle: "สร้างรอบรายเดือน",
          grossSales: "ยอดขายรวม",
          approvedSales: "ยอดขายที่อนุมัติ",
          avgRate: "% คอมเฉลี่ย",
          payoutStart: "เริ่มจ่าย",
          payoutEnd: "สิ้นสุดจ่าย",
          noProfileData: "ยังไม่มีข้อมูลฝ่ายขาย",
          noCycleData: "ยังไม่มีรอบรายเดือน",
          openAddSales: "เพิ่มพนักงานฝ่ายขาย",
          openSalesList: "รายชื่อฝ่ายขาย",
          openCommission: "ค่าคอม",
          openCommissionList: "รายการ",
          openSectionHint: "กดปุ่มเมนูด้านบนเพื่อเปิดฟอร์มแบบป๊อปอัพ",
          close: "ปิด",
          processing: "กำลังประมวลผล...",
          subMenu: "เมนูย่อย",
          searchProfiles: "ค้นหารายชื่อฝ่ายขาย",
          searchCycles: "ค้นหารอบคอมมิชชั่น",
          rowsPerPage: "แถว/หน้า",
          page: "หน้า",
          prev: "ก่อนหน้า",
          next: "ถัดไป",
          results: "รายการ",
        }
      : {
          title: "Sales Team Onboarding",
          description: "Manage sales employee profile, ID documents, and monthly commission workflow.",
          profileTitle: "Add Sales Employee",
          profileDescription: "Collect contact info and scan key fields from ID card.",
          fullName: "Full Name",
          employeeCode: "Employee Code",
          phone: "Phone",
          userAccount: "Linked User Account",
          manager: "Manager",
          currentAddress: "Current Address",
          idCardAddress: "ID Card Address",
          idCardNumber: "ID Card Number",
          notes: "Notes",
          startDate: "Start Date",
          status: "Status",
          portrait: "Portrait",
          idCardFront: "ID Card Front",
          idCardBack: "ID Card Preview",
          idScanTitle: "Scan Data From ID Card",
          idScanDescription: "Upload ID images and auto-fill name, ID number, and registered address.",
          scanIdCard: "Scan Card",
          scanInProgress: "Scanning...",
          scanNoFront: "Please upload ID card front image first",
          scanNotConfigured: "OCR service is not configured",
          scanNoData: "No data detected from ID image",
          scanFailed: "Unable to scan ID card",
          scanSuccess: "ID card data scanned",
          scanQuotaExceeded: "OCR service quota/rate limit reached. Please check your OCR server.",
          scanManualFallback:
            "Full name, ID number, and ID address are locked from scan results. Only phone and current address are manual.",
          scanTemporarilyDisabled: "ID scan is temporarily disabled. Please fill identity fields manually.",
          manualIdentityRequired: "Please provide full name, 13-digit ID card number, and ID card address before saving.",
          phoneRequired: "Please enter phone number",
          currentAddressRequired: "Please enter current address",
          scanRequiredBeforeSave: "Scan must return full name, ID number, and ID address before saving.",
          scanQualityRequirement: "Use a clear full-frame front ID card image before scanning.",
          scanQualityChecking: "Checking image quality...",
          scanImageOptimizing: "Optimizing image for upload...",
          scanCompressionFailed: "Image is still too large for upload after optimization. Please retake closer and clearer.",
          scanQualityTooLarge: "Image file is too large. Please use 8MB or smaller.",
          scanQualityTooSmall: "Image resolution is too low. Please retake closer and sharper.",
          scanQualityAspect: "Card is not fully visible. Please capture all 4 corners.",
          scanQualityTooBlurry: "Image is too blurry. Please retake with better focus and light.",
          addSales: "Save Sales Employee",
          profileListTitle: "Sales Team List",
          profileListDescription: "Review contact profile and uploaded document count.",
          cycleTitle: "Monthly Commission Workflow",
          cycleDescription: "Create monthly cycle, submit, approve/reject, and mark paid.",
          cycleProfile: "Sales Profile",
          cycleLabel: "Cycle Label",
          periodStart: "Period Start",
          periodEnd: "Period End",
          commissionAmount: "Commission Amount",
          actions: "Actions",
          submit: "Submit",
          approve: "Approve",
          reject: "Reject",
          paid: "Mark Paid",
          documents: "Documents",
          createCycle: "Create Cycle",
          grossSales: "Gross Sales",
          approvedSales: "Approved Sales",
          avgRate: "Avg Commission %",
          payoutStart: "Payout Start",
          payoutEnd: "Payout End",
          noProfileData: "No sales profile data",
          noCycleData: "No monthly cycle",
          openAddSales: "Add Sales Employee",
          openSalesList: "Sales Team List",
          openCommission: "Commission",
          openCommissionList: "Records",
          openSectionHint: "Use top buttons to open each popup form.",
          close: "Close",
          processing: "Processing...",
          subMenu: "Sub Menu",
          searchProfiles: "Search sales team",
          searchCycles: "Search commission cycles",
          rowsPerPage: "Rows/page",
          page: "Page",
          prev: "Prev",
          next: "Next",
          results: "results",
        };

  const editLabel = locale === "th" ? "\u0e41\u0e01\u0e49\u0e44\u0e02" : "Edit";
  const saveLabel = locale === "th" ? "\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01" : "Save";
  const deleteLabel = locale === "th" ? "\u0e25\u0e1a" : "Delete";
  const cancelLabel = locale === "th" ? "\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01" : "Cancel";

  const [profileForm, setProfileForm] = useState({
    fullName: "",
    phone: "",
    currentAddress: "",
    idCardAddress: "",
    idCardNumber: "",
  });

  const [profileFiles, setProfileFiles] = useState<{ idFront: File | null }>({
    idFront: null,
  });
  const [scanningIdCard, setScanningIdCard] = useState(false);
  const [idCardPreviewUrl, setIdCardPreviewUrl] = useState<string | null>(null);
  const [hasScannedIdentity, setHasScannedIdentity] = useState(false);
  const [idFrontQualityMessage, setIdFrontQualityMessage] = useState<string | null>(null);
  const [idFrontQualityPassed, setIdFrontQualityPassed] = useState(false);
  const [checkingIdFrontQuality, setCheckingIdFrontQuality] = useState(false);

  const [cycleForm, setCycleForm] = useState({
    profileId: initialProfileOptions[0]?.id ?? profiles[0]?.id ?? NONE_OPTION,
    cycleLabel: "",
    periodStart: "",
    periodEnd: "",
    payoutStart: "",
    payoutEnd: "",
    grossSales: "0",
    approvedSales: "0",
    avgRate: "0",
    commissionAmount: "0",
    notes: "",
  });

  const debouncedProfileSearch = useDebouncedValue(profileSearch, 320);
  const debouncedCycleSearch = useDebouncedValue(cycleSearch, 320);

  const hasCompleteManualIdentity =
    Boolean(profileForm.fullName.trim()) &&
    Boolean(profileForm.idCardAddress.trim()) &&
    /^\d{13}$/.test(profileForm.idCardNumber.replace(/\D/g, "").slice(0, 13));
  const hasCompleteScannedIdentity = OCR_ENABLED ? hasScannedIdentity && hasCompleteManualIdentity : hasCompleteManualIdentity;
  const canSaveProfile =
    hasCompleteScannedIdentity &&
    Boolean(profileForm.phone.trim()) &&
    Boolean(profileForm.currentAddress.trim()) &&
    !pending &&
    (!OCR_ENABLED || (!scanningIdCard && !checkingIdFrontQuality));
  const canScanIdCard =
    OCR_ENABLED && Boolean(profileFiles.idFront) && idFrontQualityPassed && !pending && !scanningIdCard && !checkingIdFrontQuality;
  const identityFieldsLocked = OCR_ENABLED;

  const pagedProfiles = useMemo(
    () => ({
      items: profiles,
      currentPage: profilePage,
      hasNext: profileHasNext,
    }),
    [profiles, profilePage, profileHasNext],
  );

  const pagedCycles = useMemo(
    () => ({
      items: cycles,
      currentPage: cyclePage,
      hasNext: cycleHasNext,
    }),
    [cycles, cyclePage, cycleHasNext],
  );

  useEffect(() => {
    setProfilePage(1);
    setProfileCursor(null);
    setProfileCursorHistory([]);
    setProfileHasNext(false);
    setProfileNextCursor(null);
  }, [profileSearch, profilePageSize]);

  useEffect(() => {
    setCyclePage(1);
    setCycleCursor(null);
    setCycleCursorHistory([]);
    setCycleHasNext(false);
    setCycleNextCursor(null);
  }, [cycleSearch, cyclePageSize]);

  useEffect(() => {
    if (!profileFiles.idFront) {
      setIdCardPreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(profileFiles.idFront);
    setIdCardPreviewUrl(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [profileFiles.idFront]);

  useEffect(() => {
    let active = true;

    const loadProfiles = async () => {
      setProfilesLoading(true);
      const result = await getSalesProfilesPageAction({
        page_size: profilePageSize,
        search: debouncedProfileSearch || null,
        cursor: profileCursor,
      });

      if (!active) {
        return;
      }

      if (!result.ok || !result.data) {
        toast.error(result.message ?? (locale === "th" ? "โหลดรายชื่อฝ่ายขายไม่สำเร็จ" : "Unable to load sales profiles"));
        setProfilesLoading(false);
        return;
      }

      setProfiles(result.data.items);
      setProfileOptions((current) =>
        mergeProfileOptions(
          current,
          result.data.items.map((item) => ({ id: item.id, name: item.fullName })),
        ),
      );
      setProfileHasNext(result.data.hasNext);
      setProfileNextCursor(result.data.nextCursor);
      setProfilesLoading(false);
    };

    void loadProfiles();

    return () => {
      active = false;
    };
  }, [profileCursor, profilePageSize, debouncedProfileSearch, locale]);

  useEffect(() => {
    let active = true;

    const loadCycles = async () => {
      setCyclesLoading(true);
      const result = await getSalesCommissionCyclesPageAction({
        page_size: cyclePageSize,
        search: debouncedCycleSearch || null,
        cursor: cycleCursor,
      });

      if (!active) {
        return;
      }

      if (!result.ok || !result.data) {
        toast.error(result.message ?? (locale === "th" ? "โหลดรายการค่าคอมไม่สำเร็จ" : "Unable to load commission cycles"));
        setCyclesLoading(false);
        return;
      }

      setCycles(result.data.items);
      setCycleHasNext(result.data.hasNext);
      setCycleNextCursor(result.data.nextCursor);
      setCyclesLoading(false);
    };

    void loadCycles();

    return () => {
      active = false;
    };
  }, [cycleCursor, cyclePageSize, debouncedCycleSearch, locale]);

  useEffect(() => {
    if (cycleForm.profileId === NONE_OPTION) {
      return;
    }

    if (!profileOptions.some((option) => option.id === cycleForm.profileId)) {
      setCycleForm((current) => ({ ...current, profileId: NONE_OPTION }));
    }
  }, [profileOptions, cycleForm.profileId]);

  useEffect(() => {
    if (!editingProfileId) {
      return;
    }

    if (!profiles.some((profile) => profile.id === editingProfileId)) {
      setEditingProfileId(null);
      setProfileDraft(null);
    }
  }, [editingProfileId, profiles]);

  useEffect(() => {
    return () => {
      if (modalCloseTimerRef.current) clearTimeout(modalCloseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && activeModal) closeModal();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeModal]);

  function openModal(modal: Exclude<SalesTeamModalType, null>) {
    if (activeModal === modal && modalOpen) {
      closeModal();
      return;
    }

    if (modalCloseTimerRef.current) clearTimeout(modalCloseTimerRef.current);
    setActiveModal(modal);
    requestAnimationFrame(() => setModalOpen(true));
  }

  function closeModal() {
    setModalOpen(false);
    modalCloseTimerRef.current = window.setTimeout(() => setActiveModal(null), MODAL_ANIMATION_MS);
  }

  function getIdFrontQualityMessage(code?: IdCardFrontQualityCode) {
    if (code === "too_large") return labels.scanQualityTooLarge;
    if (code === "too_small") return labels.scanQualityTooSmall;
    if (code === "bad_aspect_ratio") return labels.scanQualityAspect;
    if (code === "too_blurry") return labels.scanQualityTooBlurry;
    return labels.scanQualityRequirement;
  }

  async function onIdCardFrontSelected(file: File | null) {
    if (!OCR_ENABLED) {
      return;
    }
    setProfileFiles({ idFront: file });
    setHasScannedIdentity(false);
    setIdFrontQualityPassed(false);
    setIdFrontQualityMessage(null);
    setProfileForm((current) => ({
      ...current,
      fullName: "",
      idCardNumber: "",
      idCardAddress: "",
    }));

    if (!file) {
      return;
    }

    setCheckingIdFrontQuality(true);
    setIdFrontQualityMessage(labels.scanQualityChecking);

    try {
      const quality = await analyzeIdCardFrontImageQuality(file);

      if (!quality.ok) {
        setIdFrontQualityMessage(getIdFrontQualityMessage(quality.code));
        return;
      }

      setIdFrontQualityMessage(labels.scanImageOptimizing);
      const optimizedFile = await optimizeIdCardImageForUpload(file);
      setProfileFiles({ idFront: optimizedFile });
      setIdFrontQualityPassed(true);
      setIdFrontQualityMessage(null);
    } catch {
      setIdFrontQualityPassed(false);
      setIdFrontQualityMessage(labels.scanCompressionFailed);
    } finally {
      setCheckingIdFrontQuality(false);
    }
  }

  async function onScanIdCard() {
    if (!OCR_ENABLED) {
      return;
    }
    if (!profileFiles.idFront) {
      toast.error(labels.scanNoFront);
      return;
    }

    if (!idFrontQualityPassed || checkingIdFrontQuality) {
      toast.error(idFrontQualityMessage ?? labels.scanQualityRequirement);
      return;
    }

    setScanningIdCard(true);
    setHasScannedIdentity(false);

    try {
      const formData = new FormData();
      formData.set("id_card_front", profileFiles.idFront);

      const response = await fetch("/api/ocr/id-card", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        code?: string;
        message?: string;
        data?: IdCardScanResponse;
      } &
        IdCardScanResponse;

      if (!response.ok || payload.ok === false) {
        const loweredMessage = String(payload.message ?? "").toLowerCase();

        if (payload.code === "OCR_NOT_CONFIGURED") {
          toast.error(labels.scanNotConfigured);
        } else if (payload.code === "MISSING_ID_CARD_FRONT") {
          toast.error(labels.scanNoFront);
        } else if (payload.code === "OCR_NO_DATA") {
          toast.error(labels.scanNoData);
        } else if (payload.code === "OCR_QUOTA_EXCEEDED" || loweredMessage.includes("quota") || loweredMessage.includes("rate limit")) {
          toast.error(labels.scanQuotaExceeded);
        } else {
          toast.error(payload.message ?? labels.scanFailed);
        }

        return;
      }

      const result: IdCardScanResponse = payload.data ?? payload;
      const scannedName = String(result.full_name ?? result.fullName ?? "").trim();
      const scannedIdNumber = String(result.id_card_number ?? result.idCardNumber ?? "")
        .replace(/\D/g, "")
        .slice(0, 13);
      const scannedAddress = String(result.id_card_address ?? result.idCardAddress ?? "").trim();

      if (!scannedName && !scannedIdNumber && !scannedAddress) {
        toast.error(labels.scanNoData);
        return;
      }

      const hasRequiredFields = Boolean(scannedName) && /^\d{13}$/.test(scannedIdNumber) && Boolean(scannedAddress);

      setProfileForm((current) => ({
        ...current,
        fullName: scannedName || "",
        idCardNumber: scannedIdNumber || "",
        idCardAddress: scannedAddress || "",
      }));

      if (!hasRequiredFields) {
        toast.error(labels.scanRequiredBeforeSave);
        return;
      }

      setHasScannedIdentity(true);
      toast.success(labels.scanSuccess);
    } catch {
      toast.error(labels.scanFailed);
    } finally {
      setScanningIdCard(false);
    }
  }

  function onCreateProfile() {
    if (!hasCompleteScannedIdentity) {
      toast.error(OCR_ENABLED ? labels.scanRequiredBeforeSave : labels.manualIdentityRequired);
      return;
    }

    if (!profileForm.fullName.trim()) {
      toast.error(locale === "th" ? "\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e0a\u0e37\u0e48\u0e2d\u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19" : "Please enter full name");
      return;
    }

    const normalizedIdCardNumber = profileForm.idCardNumber.replace(/\D/g, "").slice(0, 13);

    if (!/^\d{13}$/.test(normalizedIdCardNumber)) {
      toast.error(OCR_ENABLED ? labels.scanRequiredBeforeSave : labels.manualIdentityRequired);
      return;
    }

    if (!profileForm.idCardAddress.trim()) {
      toast.error(OCR_ENABLED ? labels.scanRequiredBeforeSave : labels.manualIdentityRequired);
      return;
    }
    if (!profileForm.phone.trim()) {
      toast.error(labels.phoneRequired);
      return;
    }

    if (!profileForm.currentAddress.trim()) {
      toast.error(labels.currentAddressRequired);
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("full_name", profileForm.fullName.trim());
      formData.set("phone", profileForm.phone);
      formData.set("current_address", profileForm.currentAddress);
      formData.set("id_card_address", profileForm.idCardAddress);
      formData.set("id_card_number", normalizedIdCardNumber);
      formData.set("status", "active");

      if (profileFiles.idFront) formData.set("id_card_front", profileFiles.idFront);

      const result = await createSalesProfileAction(formData);

      if (!result.ok) {
        toast.error(result.message ?? (locale === "th" ? "\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08" : "Unable to save sales profile"));
        return;
      }

      const nowIso = new Date().toISOString();
      const profileDocuments: SalesProfileItem["documents"] = [];

      if (profileFiles.idFront) {
        profileDocuments.push({
          id: `${result.profile_id}-id-front`,
          type: "id_card_front",
          filePath: profileFiles.idFront.name,
          fileName: profileFiles.idFront.name,
          mimeType: profileFiles.idFront.type || "application/octet-stream",
          createdAt: nowIso,
        });
      }

      setProfiles((current) => [
        {
          id: result.profile_id,
          userId: null,
          userName: "-",
          employeeCode: "-",
          fullName: profileForm.fullName.trim(),
          phone: profileForm.phone.trim() || "-",
          currentAddress: profileForm.currentAddress.trim() || "-",
          idCardAddress: profileForm.idCardAddress.trim() || "-",
          idCardNumber: normalizedIdCardNumber || "-",
          status: "active",
          startDate: null,
          endDate: null,
          managerUserId: null,
          managerName: "-",
          notes: "",
          createdBy: null,
          createdByName: "-",
          createdAt: nowIso,
          updatedAt: nowIso,
          documents: profileDocuments,
        },
        ...current,
      ]);
      setProfileOptions((current) => mergeProfileOptions(current, [{ id: result.profile_id, name: profileForm.fullName.trim() }]));
      setCycleForm((current) => ({
        ...current,
        profileId: current.profileId === NONE_OPTION ? result.profile_id : current.profileId,
      }));

      setProfileForm({
        fullName: "",
        phone: "",
        currentAddress: "",
        idCardAddress: "",
        idCardNumber: "",
      });
      setProfileFiles({ idFront: null });
      setHasScannedIdentity(false);
      setIdFrontQualityPassed(false);
      setIdFrontQualityMessage(null);
      closeModal();
      toast.success(locale === "th" ? "\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19\u0e1d\u0e48\u0e32\u0e22\u0e02\u0e32\u0e22\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08" : "Sales profile saved");
    });
  }

  function onCreateCycle() {
    if (!cycleForm.profileId || cycleForm.profileId === NONE_OPTION) {
      toast.error(locale === "th" ? "กรุณาเลือกฝ่ายขาย" : "Please select sales profile");
      return;
    }

    startTransition(async () => {
      const result = await createSalesCommissionCycleAction({
        sales_profile_id: cycleForm.profileId,
        cycle_label: cycleForm.cycleLabel || null,
        period_start: cycleForm.periodStart,
        period_end: cycleForm.periodEnd,
        payout_window_start: cycleForm.payoutStart,
        payout_window_end: cycleForm.payoutEnd,
        gross_sales: Number(cycleForm.grossSales || 0),
        approved_sales: Number(cycleForm.approvedSales || 0),
        commission_rate_avg: Number(cycleForm.avgRate || 0),
        commission_amount: Number(cycleForm.commissionAmount || 0),
        notes: cycleForm.notes || null,
      });

      if (!result.ok) {
        toast.error(result.message ?? (locale === "th" ? "สร้างรอบไม่สำเร็จ" : "Unable to create cycle"));
        return;
      }

      const nowIso = new Date().toISOString();
      const profileName = profileOptions.find((profile) => profile.id === cycleForm.profileId)?.name ?? cycleForm.profileId;

      setCycles((current) => [
        {
          id: result.cycle_id,
          profileId: cycleForm.profileId,
          profileName,
          cycleLabel: cycleForm.cycleLabel || `${cycleForm.periodStart} - ${cycleForm.periodEnd}`,
          periodStart: cycleForm.periodStart,
          periodEnd: cycleForm.periodEnd,
          payoutWindowStart: cycleForm.payoutStart,
          payoutWindowEnd: cycleForm.payoutEnd,
          grossSales: Number(cycleForm.grossSales || 0),
          approvedSales: Number(cycleForm.approvedSales || 0),
          commissionRateAvg: Number(cycleForm.avgRate || 0),
          commissionAmount: Number(cycleForm.commissionAmount || 0),
          status: "draft",
          submittedBy: null,
          submittedByName: "-",
          approvedBy: null,
          approvedByName: "-",
          approvedAt: null,
          paidAt: null,
          notes: cycleForm.notes,
          createdAt: nowIso,
        },
        ...current,
      ]);

      setCycleForm((current) => ({
        ...current,
        cycleLabel: "",
        periodStart: "",
        periodEnd: "",
        payoutStart: "",
        payoutEnd: "",
        grossSales: "0",
        approvedSales: "0",
        avgRate: "0",
        commissionAmount: "0",
        notes: "",
      }));
      closeModal();
      toast.success(locale === "th" ? "สร้างรอบรายเดือนสำเร็จ" : "Monthly cycle created");
    });
  }

  function startProfileEdit(profile: SalesProfileItem) {
    setEditingProfileId(profile.id);
    setProfileDraft({
      fullName: profile.fullName,
      employeeCode: normalizeDisplayText(profile.employeeCode),
      phone: normalizeDisplayText(profile.phone),
      userId: profile.userId ?? NONE_OPTION,
      managerId: profile.managerUserId ?? NONE_OPTION,
      status: toProfileStatus(profile.status),
    });
  }

  function updateProfileDraftField<K extends keyof SalesProfileDraft>(field: K, value: SalesProfileDraft[K]) {
    setProfileDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [field]: value,
      };
    });
  }

  function cancelProfileEdit() {
    setEditingProfileId(null);
    setProfileDraft(null);
    setProfileSavingId(null);
  }

  function onSaveProfile(profileId: string) {
    if (!profileDraft || editingProfileId !== profileId) {
      return;
    }

    if (!profileDraft.fullName.trim()) {
      toast.error(locale === "th" ? "\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e0a\u0e37\u0e48\u0e2d\u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19" : "Please enter full name");
      return;
    }

    const draft = profileDraft;
    setProfileSavingId(profileId);

    startTransition(async () => {
      const result = await updateSalesProfileAction({
        profile_id: profileId,
        full_name: draft.fullName.trim(),
        employee_code: draft.employeeCode,
        phone: draft.phone,
        user_id: draft.userId === NONE_OPTION ? "" : draft.userId,
        manager_user_id: draft.managerId === NONE_OPTION ? "" : draft.managerId,
        status: draft.status,
      });

      if (!result.ok) {
        toast.error(result.message ?? (locale === "th" ? "\u0e41\u0e01\u0e49\u0e44\u0e02\u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08" : "Unable to update sales profile"));
        setProfileSavingId(null);
        return;
      }

      const updatedAt = new Date().toISOString();
      const userName = draft.userId !== NONE_OPTION ? staffUsers.find((item) => item.id === draft.userId)?.name ?? "-" : "-";
      const managerName = draft.managerId !== NONE_OPTION ? managers.find((item) => item.id === draft.managerId)?.name ?? "-" : "-";

      setProfiles((current) =>
        current.map((profile) => {
          if (profile.id !== profileId) {
            return profile;
          }

          return {
            ...profile,
            fullName: draft.fullName.trim(),
            employeeCode: draft.employeeCode.trim() || "-",
            phone: draft.phone.trim() || "-",
            userId: draft.userId === NONE_OPTION ? null : draft.userId,
            userName,
            managerUserId: draft.managerId === NONE_OPTION ? null : draft.managerId,
            managerName,
            status: draft.status,
            updatedAt,
          };
        }),
      );

      setProfileOptions((current) => mergeProfileOptions(current, [{ id: profileId, name: draft.fullName.trim() }]));
      setCycles((current) => current.map((cycle) => (cycle.profileId === profileId ? { ...cycle, profileName: draft.fullName.trim() } : cycle)));

      toast.success(locale === "th" ? "\u0e41\u0e01\u0e49\u0e44\u0e02\u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19\u0e1d\u0e48\u0e32\u0e22\u0e02\u0e32\u0e22\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08" : "Sales profile updated");
      setEditingProfileId(null);
      setProfileDraft(null);
      setProfileSavingId(null);
    });
  }

  function onDeleteProfile(profile: SalesProfileItem) {
    setProfileDeletingId(profile.id);

    startTransition(async () => {
      const result = await deleteSalesProfileAction({ profile_id: profile.id });

      if (!result.ok) {
        toast.error(result.message ?? (locale === "th" ? "\u0e25\u0e1a\u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08" : "Unable to delete sales profile"));
        setProfileDeletingId(null);
        return;
      }

      setProfiles((current) => current.filter((item) => item.id !== profile.id));
      setProfileOptions((current) => current.filter((item) => item.id !== profile.id));
      setCycles((current) => current.filter((cycle) => cycle.profileId !== profile.id));
      setCycleForm((current) => ({
        ...current,
        profileId: current.profileId === profile.id ? NONE_OPTION : current.profileId,
      }));

      if (editingProfileId === profile.id) {
        setEditingProfileId(null);
        setProfileDraft(null);
      }

      toast.success(locale === "th" ? "\u0e25\u0e1a\u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19\u0e1d\u0e48\u0e32\u0e22\u0e02\u0e32\u0e22\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08" : "Sales profile deleted");
      setProfileDeletingId(null);
    });
  }

  function onUpdateCycleStatus(cycleId: string, status: CycleStatusAction) {
    setProcessingCycleId(cycleId);

    startTransition(async () => {
      const result = await updateSalesCommissionCycleStatusAction({ cycle_id: cycleId, status });

      if (!result.ok) {
        toast.error(result.message ?? (locale === "th" ? "อัปเดตสถานะไม่สำเร็จ" : "Unable to update cycle status"));
        setProcessingCycleId(null);
        return;
      }

      const nowIso = new Date().toISOString();

      setCycles((current) =>
        current.map((cycle) => {
          if (cycle.id !== cycleId) {
            return cycle;
          }

          return {
            ...cycle,
            status,
            approvedAt: status === "approved" || status === "rejected" ? nowIso : cycle.approvedAt,
            paidAt: status === "paid" ? nowIso : cycle.paidAt,
          };
        }),
      );
      toast.success(locale === "th" ? "อัปเดตสถานะเรียบร้อย" : "Status updated");
      setProcessingCycleId(null);
    });
  }


  function renderTableToolbar(props: {
    searchValue: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder: string;
    pageSize: number;
    onPageSizeChange: (value: number) => void;
    page: number;
    itemsCount: number;
    canPrev: boolean;
    hasNext: boolean;
    loading?: boolean;
    onPrev: () => void;
    onNext: () => void;
  }) {
    return (
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <Input
          value={props.searchValue}
          onChange={(event) => props.onSearchChange(event.target.value)}
          placeholder={props.searchPlaceholder}
          className="w-full md:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{labels.rowsPerPage}</span>
          <select
            value={props.pageSize}
            onChange={(event) => props.onPageSizeChange(Number(event.target.value))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span>{labels.page} {props.page}</span>
          <span>({props.itemsCount} {labels.results})</span>
          {props.loading ? <span className="text-xs">{labels.processing}</span> : null}
          <Button type="button" variant="outline" size="sm" onClick={props.onPrev} disabled={Boolean(props.loading) || !props.canPrev}>{labels.prev}</Button>
          <Button type="button" variant="outline" size="sm" onClick={props.onNext} disabled={Boolean(props.loading) || !props.hasNext}>{labels.next}</Button>
        </div>
      </div>
    );
  }


  function renderAddSalesContent() {
    const disableProfileInput = (OCR_ENABLED && !hasCompleteScannedIdentity) || pending || scanningIdCard || checkingIdFrontQuality;
    const disableIdentityInput = pending || (OCR_ENABLED && (scanningIdCard || checkingIdFrontQuality));

    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{labels.profileTitle}</h3>
          <p className="text-sm text-muted-foreground">{labels.profileDescription}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder={labels.fullName}
            value={profileForm.fullName}
            readOnly={identityFieldsLocked}
            disabled={disableIdentityInput}
            className={identityFieldsLocked ? "bg-slate-100 text-slate-700" : undefined}
            onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))}
          />
          <Input
            placeholder={labels.phone}
            value={profileForm.phone}
            disabled={disableProfileInput}
            onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
          />

          <Textarea
            className="md:col-span-2 min-h-[56px]"
            placeholder={labels.currentAddress}
            value={profileForm.currentAddress}
            disabled={disableProfileInput}
            onChange={(event) => setProfileForm((current) => ({ ...current, currentAddress: event.target.value }))}
          />

          {OCR_ENABLED ? (
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{labels.idScanTitle}</p>
                  <p className="text-xs text-muted-foreground">{labels.idScanDescription}</p>
                </div>
                <Button type="button" variant="outline" disabled={!canScanIdCard} onClick={onScanIdCard}>
                  {checkingIdFrontQuality ? labels.scanQualityChecking : scanningIdCard ? labels.scanInProgress : labels.scanIdCard}
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-sm">{labels.idCardFront}</p>
                  <Input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => {
                      void onIdCardFrontSelected(event.target.files?.[0] ?? null);
                    }}
                  />
                  {idFrontQualityMessage ? (
                    <p className={`mt-1 text-xs ${checkingIdFrontQuality ? "text-muted-foreground" : idFrontQualityPassed ? "text-emerald-600" : "text-destructive"}`}>{idFrontQualityMessage}</p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">{labels.scanQualityRequirement}</p>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-sm">{labels.idCardBack}</p>
                  {idCardPreviewUrl ? (
                    <img src={idCardPreviewUrl} alt={labels.idCardBack} className="h-40 w-full rounded-md border border-slate-200 bg-white object-contain p-1" />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center rounded-md border border-dashed border-slate-300 bg-white px-3 text-xs text-muted-foreground">
                      {labels.scanNoFront}
                    </div>
                  )}
                </div>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">{labels.scanManualFallback}</p>
              {!hasCompleteScannedIdentity ? <p className="mt-1 text-xs text-destructive">{labels.scanRequiredBeforeSave}</p> : null}
            </div>
          ) : (
            <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-sm font-semibold text-amber-900">{labels.idScanTitle}</p>
              <p className="mt-1 text-xs text-amber-800">{labels.scanTemporarilyDisabled}</p>
            </div>
          )}

          <Input
            placeholder={labels.idCardNumber}
            value={profileForm.idCardNumber}
            readOnly={identityFieldsLocked}
            disabled={disableIdentityInput}
            className={identityFieldsLocked ? "bg-slate-100 text-slate-700" : undefined}
            onChange={(event) =>
              setProfileForm((current) => ({
                ...current,
                idCardNumber: event.target.value.replace(/\D/g, "").slice(0, 13),
              }))
            }
          />
          <div />

          <Textarea
            className={`md:col-span-2 min-h-[56px] ${identityFieldsLocked ? "bg-slate-100 text-slate-700" : ""}`}
            placeholder={labels.idCardAddress}
            value={profileForm.idCardAddress}
            readOnly={identityFieldsLocked}
            disabled={disableIdentityInput}
            onChange={(event) => setProfileForm((current) => ({ ...current, idCardAddress: event.target.value }))}
          />

          <div className="md:col-span-2 flex justify-end">
            <Button type="button" disabled={!canSaveProfile} onClick={onCreateProfile}>
              {labels.addSales}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function renderSalesListContent() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{labels.profileListTitle}</h3>
          <p className="text-sm text-muted-foreground">{labels.profileListDescription}</p>
        </div>

        {renderTableToolbar({
          searchValue: profileSearch,
          onSearchChange: setProfileSearch,
          searchPlaceholder: labels.searchProfiles,
          pageSize: profilePageSize,
          onPageSizeChange: setProfilePageSize,
          page: pagedProfiles.currentPage,
          itemsCount: pagedProfiles.items.length,
          canPrev: profileCursorHistory.length > 0,
          hasNext: pagedProfiles.hasNext,
          loading: profilesLoading,
          onPrev: () => {
            if (profileCursorHistory.length === 0) {
              return;
            }

            setProfileCursorHistory((current) => {
              const next = [...current];
              const previousCursor = next.pop() ?? null;
              setProfileCursor(previousCursor);
              return next;
            });
            setProfilePage((current) => Math.max(1, current - 1));
          },
          onNext: () => {
            if (!profileHasNext || !profileNextCursor) {
              return;
            }

            setProfileCursorHistory((current) => [...current, profileCursor]);
            setProfileCursor(profileNextCursor);
            setProfilePage((current) => current + 1);
          },
        })}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.fullName}</TableHead>
              <TableHead>{labels.employeeCode}</TableHead>
              <TableHead>{labels.phone}</TableHead>
              <TableHead>{labels.userAccount}</TableHead>
              <TableHead>{labels.manager}</TableHead>
              <TableHead>{labels.documents}</TableHead>
              <TableHead>{labels.status}</TableHead>
              <TableHead>{labels.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedProfiles.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  {labels.noProfileData}
                </TableCell>
              </TableRow>
            ) : (
              pagedProfiles.items.map((profile) => {
                const isEditing = editingProfileId === profile.id;
                const draft = isEditing ? profileDraft : null;

                return (
                  <TableRow key={profile.id}>
                    <TableCell className="min-w-[220px]">
                      {isEditing && draft ? (
                        <Input value={draft.fullName} onChange={(event) => updateProfileDraftField("fullName", event.target.value)} placeholder={labels.fullName} />
                      ) : (
                        profile.fullName
                      )}
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      {isEditing && draft ? (
                        <Input value={draft.employeeCode} onChange={(event) => updateProfileDraftField("employeeCode", event.target.value)} placeholder={labels.employeeCode} />
                      ) : (
                        profile.employeeCode
                      )}
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      {isEditing && draft ? (
                        <Input value={draft.phone} onChange={(event) => updateProfileDraftField("phone", event.target.value)} placeholder={labels.phone} />
                      ) : (
                        profile.phone
                      )}
                    </TableCell>
                    <TableCell className="min-w-[190px]">
                      {isEditing && draft ? (
                        <Select value={draft.userId} onValueChange={(value) => updateProfileDraftField("userId", value)}>
                          <SelectTrigger>
                            <SelectValue placeholder={labels.userAccount} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_OPTION}>-</SelectItem>
                            {staffUsers.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        profile.userName
                      )}
                    </TableCell>
                    <TableCell className="min-w-[190px]">
                      {isEditing && draft ? (
                        <Select value={draft.managerId} onValueChange={(value) => updateProfileDraftField("managerId", value)}>
                          <SelectTrigger>
                            <SelectValue placeholder={labels.manager} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_OPTION}>-</SelectItem>
                            {managers.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        profile.managerName
                      )}
                    </TableCell>
                    <TableCell>{profile.documents.length}</TableCell>
                    <TableCell className="min-w-[160px]">
                      {isEditing && draft ? (
                        <Select value={draft.status} onValueChange={(value) => updateProfileDraftField("status", toProfileStatus(value))}>
                          <SelectTrigger>
                            <SelectValue placeholder={labels.status} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">active</SelectItem>
                            <SelectItem value="inactive">inactive</SelectItem>
                            <SelectItem value="suspended">suspended</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={statusBadgeVariant(profile.status)}>{profile.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[220px]">
                      <div className="flex flex-wrap gap-2">
                        {isEditing ? (
                          <>
                            <Button size="sm" disabled={pending || profileSavingId === profile.id} onClick={() => onSaveProfile(profile.id)}>
                              {profileSavingId === profile.id ? labels.processing : saveLabel}
                            </Button>
                            <Button size="sm" variant="outline" disabled={pending || profileSavingId === profile.id} onClick={cancelProfileEdit}>
                              {cancelLabel}
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending || Boolean(editingProfileId && editingProfileId !== profile.id)}
                            onClick={() => startProfileEdit(profile)}
                          >
                            {editLabel}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={pending || profileSavingId === profile.id || profileDeletingId === profile.id}
                          onClick={() => onDeleteProfile(profile)}
                        >
                          {profileDeletingId === profile.id ? labels.processing : deleteLabel}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  function renderCommissionContent() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{labels.cycleTitle}</h3>
          <p className="text-sm text-muted-foreground">{labels.cycleDescription}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Select value={cycleForm.profileId} onValueChange={(value) => setCycleForm((current) => ({ ...current, profileId: value }))}>
            <SelectTrigger>
              <SelectValue placeholder={labels.cycleProfile} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_OPTION}>-</SelectItem>
              {profileOptions.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input placeholder={labels.cycleLabel} value={cycleForm.cycleLabel} onChange={(event) => setCycleForm((current) => ({ ...current, cycleLabel: event.target.value }))} />
          <Input type="date" value={cycleForm.periodStart} onChange={(event) => setCycleForm((current) => ({ ...current, periodStart: event.target.value }))} />
          <Input type="date" value={cycleForm.periodEnd} onChange={(event) => setCycleForm((current) => ({ ...current, periodEnd: event.target.value }))} />
          <Input type="date" value={cycleForm.payoutStart} onChange={(event) => setCycleForm((current) => ({ ...current, payoutStart: event.target.value }))} />
          <Input type="date" value={cycleForm.payoutEnd} onChange={(event) => setCycleForm((current) => ({ ...current, payoutEnd: event.target.value }))} />
          <Input type="number" min={0} step="0.01" placeholder={labels.grossSales} value={cycleForm.grossSales} onChange={(event) => setCycleForm((current) => ({ ...current, grossSales: event.target.value }))} />
          <Input type="number" min={0} step="0.01" placeholder={labels.approvedSales} value={cycleForm.approvedSales} onChange={(event) => setCycleForm((current) => ({ ...current, approvedSales: event.target.value }))} />
          <Input type="number" min={0} max={100} step="0.01" placeholder={labels.avgRate} value={cycleForm.avgRate} onChange={(event) => setCycleForm((current) => ({ ...current, avgRate: event.target.value }))} />
          <Input type="number" min={0} step="0.01" placeholder={labels.commissionAmount} value={cycleForm.commissionAmount} onChange={(event) => setCycleForm((current) => ({ ...current, commissionAmount: event.target.value }))} />
          <Textarea className="md:col-span-2 min-h-[40px]" placeholder={labels.notes} value={cycleForm.notes} onChange={(event) => setCycleForm((current) => ({ ...current, notes: event.target.value }))} />

          <div className="md:col-span-4 flex justify-end">
            <Button type="button" disabled={pending} onClick={onCreateCycle}>
              {labels.createCycle}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function renderCommissionListContent() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{labels.openCommissionList}</h3>
          <p className="text-sm text-muted-foreground">{labels.cycleDescription}</p>
        </div>

        {renderTableToolbar({
          searchValue: cycleSearch,
          onSearchChange: setCycleSearch,
          searchPlaceholder: labels.searchCycles,
          pageSize: cyclePageSize,
          onPageSizeChange: setCyclePageSize,
          page: pagedCycles.currentPage,
          itemsCount: pagedCycles.items.length,
          canPrev: cycleCursorHistory.length > 0,
          hasNext: pagedCycles.hasNext,
          loading: cyclesLoading,
          onPrev: () => {
            if (cycleCursorHistory.length === 0) {
              return;
            }

            setCycleCursorHistory((current) => {
              const next = [...current];
              const previousCursor = next.pop() ?? null;
              setCycleCursor(previousCursor);
              return next;
            });
            setCyclePage((current) => Math.max(1, current - 1));
          },
          onNext: () => {
            if (!cycleHasNext || !cycleNextCursor) {
              return;
            }

            setCycleCursorHistory((current) => [...current, cycleCursor]);
            setCycleCursor(cycleNextCursor);
            setCyclePage((current) => current + 1);
          },
        })}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.cycleProfile}</TableHead>
              <TableHead>{labels.cycleLabel}</TableHead>
              <TableHead>{labels.periodStart}</TableHead>
              <TableHead>{labels.periodEnd}</TableHead>
              <TableHead>{labels.commissionAmount}</TableHead>
              <TableHead>{labels.status}</TableHead>
              <TableHead>{labels.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedCycles.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  {labels.noCycleData}
                </TableCell>
              </TableRow>
            ) : (
              pagedCycles.items.map((cycle) => (
                <TableRow key={cycle.id}>
                  <TableCell>{cycle.profileName}</TableCell>
                  <TableCell>{cycle.cycleLabel || "-"}</TableCell>
                  <TableCell>{cycle.periodStart}</TableCell>
                  <TableCell>{cycle.periodEnd}</TableCell>
                  <TableCell>{cycle.commissionAmount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(cycle.status)}>{cycleStatusLabel(cycle.status, locale)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => onUpdateCycleStatus(cycle.id, "submitted")}>
                        {processingCycleId === cycle.id && pending ? labels.processing : labels.submit}
                      </Button>
                      <Button size="sm" disabled={pending} onClick={() => onUpdateCycleStatus(cycle.id, "approved")}>
                        {labels.approve}
                      </Button>
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => onUpdateCycleStatus(cycle.id, "rejected")}>
                        {labels.reject}
                      </Button>
                      <Button size="sm" variant="secondary" disabled={pending} onClick={() => onUpdateCycleStatus(cycle.id, "paid")}>
                        {labels.paid}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  let modalMeta: {
    title: string;
    widthClass: string;
    panelClass: string;
    contentMaxHeightClass: string;
    icon: ReactNode;
    content: ReactNode;
  } | null = null;

  if (activeModal === "add-sales") {
    modalMeta = {
      title: labels.openAddSales,
      widthClass: "max-w-6xl",
      panelClass: "min-h-[82vh]",
      contentMaxHeightClass: "max-h-[72vh]",
      icon: <UserPlus className="h-5 w-5" />,
      content: renderAddSalesContent(),
    };
  } else if (activeModal === "sales-list") {
    modalMeta = {
      title: labels.openSalesList,
      widthClass: "max-w-7xl",
      panelClass: "min-h-[70vh]",
      contentMaxHeightClass: "max-h-[66vh]",
      icon: <ListChecks className="h-5 w-5" />,
      content: renderSalesListContent(),
    };
  } else if (activeModal === "commission") {
    modalMeta = {
      title: labels.openCommission,
      widthClass: "max-w-5xl",
      panelClass: "min-h-[66vh]",
      contentMaxHeightClass: "max-h-[62vh]",
      icon: <Coins className="h-5 w-5" />,
      content: renderCommissionContent(),
    };
  } else if (activeModal === "commission-list") {
    modalMeta = {
      title: labels.openCommissionList,
      widthClass: "max-w-7xl",
      panelClass: "min-h-[74vh]",
      contentMaxHeightClass: "max-h-[68vh]",
      icon: <ClipboardList className="h-5 w-5" />,
      content: renderCommissionListContent(),
    };
  }

  function renderActionButton(icon: ReactNode, label: string, modalType: Exclude<SalesTeamModalType, null>) {
    const isActive = activeModal === modalType && modalOpen;

    return (
      <Button
        type="button"
        variant="outline"
        className={`gap-2 transition-colors ${
          isActive
            ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-600 hover:text-white"
            : "hover:border-blue-300 hover:bg-blue-50/60"
        }`}
        onClick={() => openModal(modalType)}
        disabled={pending}
      >
        {icon}
        <span>{label}</span>
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{labels.title}</CardTitle>
          <CardDescription>{labels.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {renderActionButton(<UserPlus className="h-4 w-4" />, labels.openAddSales, "add-sales")}
            {renderActionButton(<ListChecks className="h-4 w-4" />, labels.openSalesList, "sales-list")}
            {renderActionButton(<Coins className="h-4 w-4" />, labels.openCommission, "commission")}
            {renderActionButton(<ClipboardList className="h-4 w-4" />, labels.openCommissionList, "commission-list")}
          </div>
        </CardContent>
      </Card>

      {modalMeta ? (
        <div
          className={`fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 transition-opacity duration-200 ${
            modalOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={closeModal}
        >
          <div
            className={`w-full ${modalMeta.widthClass} ${modalMeta.panelClass} rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transform-gpu transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              modalOpen ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
            }`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={modalMeta.title}
          >
            <div className="flex items-start justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <span className="rounded-full bg-slate-100 p-2 text-slate-600">{modalMeta.icon}</span>
                <h3 className="text-lg font-semibold">{modalMeta.title}</h3>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closeModal}>
                <X className="h-4 w-4" />
                <span className="sr-only">{labels.close}</span>
              </Button>
            </div>

            <div className={`mt-4 ${modalMeta.contentMaxHeightClass} overflow-y-auto px-1 pt-1 pb-1`}>{modalMeta.content}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


























