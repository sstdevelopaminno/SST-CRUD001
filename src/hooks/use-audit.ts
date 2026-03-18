"use client";

import { useCallback, useTransition } from "react";

import { logAuditEventAction } from "@/app/actions/audit";

interface TrackPayload {
  action_type: string;
  entity_type: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
}

export function useAudit() {
  const [, startTransition] = useTransition();

  const track = useCallback((payload: TrackPayload) => {
    startTransition(() => {
      void logAuditEventAction({
        ...payload,
        metadata: {
          ...payload.metadata,
          device_info: navigator.userAgent,
        },
      });
    });
  }, []);

  return { track };
}
