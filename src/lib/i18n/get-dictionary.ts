import { cache } from "react";

import { resolveLocale, type AppLocale } from "@/lib/i18n/config";

const dictionaries = {
  en: () => import("@/lib/i18n/messages/en").then((module) => module.default),
  th: () => import("@/lib/i18n/messages/th").then((module) => module.default),
};

export const getDictionary = cache(async (locale: AppLocale) => {
  return dictionaries[locale]();
});

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;

export async function getDictionaryByPath(localeInput: string | undefined) {
  const locale = resolveLocale(localeInput);
  return {
    locale,
    dictionary: await getDictionary(locale),
  };
}
