"use client";

import { useMemo } from "react";

export function useFeatureFlags(flags: { key: string; enabled: boolean }[]) {
  return useMemo(() => {
    return flags.reduce<Record<string, boolean>>((acc, item) => {
      acc[item.key] = item.enabled;
      return acc;
    }, {});
  }, [flags]);
}
