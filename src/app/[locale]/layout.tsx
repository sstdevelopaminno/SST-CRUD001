import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { resolveLocale, type AppLocale } from "@/lib/i18n/config";

export default function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const locale = resolveLocale(params.locale);

  if (locale !== params.locale) {
    notFound();
  }

  return <>{children}</>;
}

export function generateStaticParams(): { locale: AppLocale }[] {
  return [{ locale: "en" }, { locale: "th" }];
}
