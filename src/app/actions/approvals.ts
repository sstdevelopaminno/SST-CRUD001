"use server";

import { assertPermission } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit";
import { createInAppNotification } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

export async function updateApprovalStatusAction(payload: {
  approval_id: string;
  status: "approved" | "rejected";
  note?: string;
  ceo_override?: boolean;
}) {
  const user = await assertPermission("approvals:approve");

  const supabase = createClient();

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured" };
  }

  const status = payload.ceo_override && user.role === "CEO" ? "approved" : payload.status;

  const { data: approval, error } = await supabase
    .from("approvals")
    .update({
      status,
      approver_id: user.id,
      approved_at: new Date().toISOString(),
      note: payload.note ?? null,
    })
    .eq("id", payload.approval_id)
    .select("id, requester_id, entity_type, entity_id")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  await logAuditEvent({
    action_type: status === "approved" ? "approval_approved" : "approval_rejected",
    entity_type: "approvals",
    entity_id: payload.approval_id,
    metadata: {
      approver_role: user.role,
      ceo_override: payload.ceo_override ?? false,
      note: payload.note,
    },
  });

  if (approval?.requester_id) {
    await createInAppNotification(
      approval.requester_id,
      status === "approved" ? "Approval completed" : "Approval rejected",
      `${approval.entity_type} ${approval.entity_id} was ${status} by ${user.full_name}.`,
    );
  }

  return { ok: true, message: "Updated" };
}
