import type { SystemRole } from "@/types";

export const LOCALES = ["en", "th"] as const;
export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

export const ROLE_LABELS: Record<SystemRole, Record<AppLocale, string>> = {
  CEO: { en: "CEO", th: "ผู้บริหารสูงสุด" },
  MANAGER: { en: "Manager", th: "ผู้จัดการ" },
  HEAD: { en: "Head", th: "หัวหน้าแผนก" },
  STAFF: { en: "Staff", th: "พนักงาน" },
  IT: { en: "IT", th: "ไอที" },
};

export function isLocale(value: string): value is AppLocale {
  return (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: string | undefined): AppLocale {
  if (!value) {
    return DEFAULT_LOCALE;
  }

  return isLocale(value) ? value : DEFAULT_LOCALE;
}
