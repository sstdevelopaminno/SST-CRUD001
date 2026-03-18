import { createClient } from "@/lib/supabase/server";
import { approvals } from "@/services/mock-data";

const DEFAULT_LIMIT = 100;

export async function getApprovals(limit = DEFAULT_LIMIT) {
  const supabase = createClient();

  if (!supabase) {
    return approvals.slice(0, limit);
  }

  const safeLimit = Math.min(Math.max(limit, 1), 200);

  const { data, error } = await supabase
    .from("approvals")
    .select("id, entity_type, entity_id, level, requester_id, approver_id, status, note")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error || !data) {
    return approvals.slice(0, safeLimit);
  }

  return data.map((item) => ({
    id: item.id,
    entity: `${item.entity_type} ${item.entity_id}`,
    level: item.level,
    requester: item.requester_id,
    approver: item.approver_id ?? "Unassigned",
    status: item.status,
    history: item.note ? [item.note] : ["Pending review"],
  }));
}
