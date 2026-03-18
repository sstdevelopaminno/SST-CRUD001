import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/server";
import { getDictionaryByPath } from "@/lib/i18n/get-dictionary";
import { getEnabledModuleMap } from "@/services/feature-flag.service";

export default async function ProtectedLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const { locale, dictionary } = await getDictionaryByPath(params.locale);
  const user = await requireUser(locale);

  if (!user.active) {
    redirect(`/${locale}/login`);
  }

  const featureMap = await getEnabledModuleMap();

  return (
    <AppShell locale={locale} dictionary={dictionary} user={user} featureMap={featureMap}>
      {children}
    </AppShell>
  );
}
