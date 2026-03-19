import * as React from "react";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import { NAV_ITEMS } from "@/lib/constants/routes";
import type { AppLocale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { hasPermission } from "@/lib/rbac";
import type { UserProfile } from "@/types";

interface AppShellProps {
  locale: AppLocale;
  dictionary: Dictionary;
  user: UserProfile;
  featureMap: Record<string, boolean>;
  children: React.ReactNode;
}

export function AppShell({ locale, dictionary, user, featureMap, children }: AppShellProps) {
  const navItems = NAV_ITEMS.filter((item) => featureMap[item.featureFlag] !== false && hasPermission(user.role, item.permission)).map((item) => ({
    ...item,
    label:
      item.key === "it-panel"
        ? dictionary.nav.itPanel
        : item.key === "sales-team"
          ? dictionary.nav.salesTeam
          : dictionary.nav[item.key as Exclude<typeof item.key, "it-panel" | "sales-team">],
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <SidebarNav locale={locale} items={navItems} role={user.role} />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar locale={locale} dictionary={dictionary} name={user.full_name} email={user.email} />
          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
