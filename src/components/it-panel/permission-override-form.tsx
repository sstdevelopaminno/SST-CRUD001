"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { forceOverridePermissionAction } from "@/app/actions/system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PermissionOverrideForm() {
  const [pending, startTransition] = useTransition();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"CEO" | "MANAGER" | "HEAD" | "STAFF" | "IT">("STAFF");

  function submit() {
    if (!userId) {
      toast.error("User ID is required");
      return;
    }

    startTransition(async () => {
      const result = await forceOverridePermissionAction({
        user_id: userId,
        role,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Permission override applied");
      setUserId("");
    });
  }

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <p className="text-sm font-medium">Force Override Permissions</p>
      <Input placeholder="Target user UUID" value={userId} onChange={(event) => setUserId(event.target.value)} />
      <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="CEO">CEO</SelectItem>
          <SelectItem value="MANAGER">MANAGER</SelectItem>
          <SelectItem value="HEAD">HEAD</SelectItem>
          <SelectItem value="STAFF">STAFF</SelectItem>
          <SelectItem value="IT">IT</SelectItem>
        </SelectContent>
      </Select>
      <Button onClick={submit} disabled={pending} data-audit-action="force-override-role" data-audit-type="it-panel">
        Apply Override
      </Button>
    </div>
  );
}
