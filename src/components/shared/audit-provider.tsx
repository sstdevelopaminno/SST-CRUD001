"use client";

import * as React from "react";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { useAudit } from "@/hooks/use-audit";

export function AuditProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { track } = useAudit();

  useEffect(() => {
    track({
      action_type: "page_visit",
      entity_type: "route",
      entity_id: pathname,
      metadata: { path: pathname },
    });
  }, [pathname, track]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const actionElement = target?.closest("[data-audit-action]") as HTMLElement | null;

      if (!actionElement) {
        return;
      }

      track({
        action_type: "click",
        entity_type: actionElement.dataset.auditType ?? "ui",
        entity_id: actionElement.dataset.auditId ?? actionElement.innerText,
        metadata: {
          action: actionElement.dataset.auditAction,
          path: pathname,
        },
      });
    };

    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [pathname, track]);

  return <>{children}</>;
}

