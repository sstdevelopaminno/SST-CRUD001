"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Briefcase, ClipboardList, FileText, LayoutDashboard, Settings2, Shield, Users, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type NavKey = "dashboard" | "crm" | "projects" | "jobs" | "billing" | "documents" | "approvals" | "admin" | "it-panel";

const ICONS: Record<NavKey, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  crm: Users,
  projects: Briefcase,
  jobs: ClipboardList,
  billing: Wallet,
  documents: FileText,
  approvals: Shield,
  admin: Settings2,
  "it-panel": BarChart3,
};

interface SidebarNavItem {
  key: NavKey;
  href: string;
  label: string;
}

interface SidebarNavProps {
  locale: string;
  items: SidebarNavItem[];
  role: string;
}

export function SidebarNav({ locale, items, role }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="hidden w-72 shrink-0 border-r bg-card/60 lg:block">
      <div className="sticky top-0 flex h-screen flex-col p-4">
        <div className="mb-6 rounded-lg border bg-background p-4">
          <p className="text-sm font-semibold">SST INNOVATION</p>
          <p className="text-xs text-muted-foreground">Enterprise Backoffice</p>
          <Badge variant="secondary" className="mt-2">
            {role}
          </Badge>
        </div>
        <nav className="space-y-1">
          {items.map((item) => {
            const Icon = ICONS[item.key];
            const href = `/${locale}${item.href}`;
            const isActive = pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={item.key}
                href={href}
                prefetch
                onMouseEnter={() => router.prefetch(href)}
                onFocus={() => router.prefetch(href)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
