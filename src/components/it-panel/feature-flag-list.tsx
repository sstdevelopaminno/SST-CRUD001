"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { updateFeatureFlagAction } from "@/app/actions/system";
import { Switch } from "@/components/ui/switch";

interface FeatureFlag {
  id: string;
  key: string;
  module: string;
  enabled: boolean;
  description: string | null;
}

export function FeatureFlagList({ flags }: { flags: FeatureFlag[] }) {
  const [pending, startTransition] = useTransition();

  function onToggle(id: string, enabled: boolean) {
    startTransition(async () => {
      const result = await updateFeatureFlagAction({ id, enabled });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Feature flag updated");
    });
  }

  return (
    <div className="space-y-3">
      {flags.map((flag) => (
        <div key={flag.id} className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="font-medium">{flag.module}</p>
            <p className="text-xs text-muted-foreground">{flag.description ?? flag.key}</p>
          </div>
          <Switch
            checked={flag.enabled}
            disabled={pending}
            onCheckedChange={(checked) => onToggle(flag.id, checked)}
            data-audit-action="toggle-feature-flag"
            data-audit-type="it-panel"
            data-audit-id={flag.key}
          />
        </div>
      ))}
    </div>
  );
}
