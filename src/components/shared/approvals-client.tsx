"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { updateApprovalStatusAction } from "@/app/actions/approvals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ApprovalItem {
  id: string;
  entity: string;
  level: number;
  requester: string;
  approver: string;
  status: string;
  history: string[];
}

export function ApprovalsClient({
  title,
  approveLabel,
  rejectLabel,
  overrideLabel,
  isCeo,
  items,
}: {
  title: string;
  approveLabel: string;
  rejectLabel: string;
  overrideLabel: string;
  isCeo: boolean;
  items: ApprovalItem[];
}) {
  const [pending, startTransition] = useTransition();

  function updateStatus(id: string, status: "approved" | "rejected", ceoOverride = false) {
    startTransition(async () => {
      const result = await updateApprovalStatusAction({
        approval_id: id,
        status,
        ceo_override: ceoOverride,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Approval updated");
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <CardTitle className="text-base">{item.entity}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <p>Level: {item.level}</p>
              <p>Status: {item.status}</p>
              <p>Requester: {item.requester}</p>
              <p>Approver: {item.approver}</p>
            </div>
            <div className="rounded-lg bg-muted p-3 text-sm">
              {item.history.map((history) => (
                <p key={history}>- {history}</p>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => updateStatus(item.id, "approved")} disabled={pending} data-audit-action="approval-approve" data-audit-type="approvals">
                {approveLabel}
              </Button>
              <Button onClick={() => updateStatus(item.id, "rejected")} variant="destructive" disabled={pending} data-audit-action="approval-reject" data-audit-type="approvals">
                {rejectLabel}
              </Button>
              {isCeo ? (
                <Button onClick={() => updateStatus(item.id, "approved", true)} variant="outline" disabled={pending} data-audit-action="approval-ceo-override" data-audit-type="approvals">
                  {overrideLabel}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
