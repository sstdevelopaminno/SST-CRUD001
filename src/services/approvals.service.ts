import { createClient } from "@/lib/supabase/server";
import { approvals } from "@/services/mock-data";

export async function getApprovals() {
  const supabase = createClient();

  if (!supabase) {
    return approvals;
  }

  const { data, error } = await supabase
    .from("approvals")
    .select("id, entity_type, entity_id, level, requester_id, approver_id, status, note")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return approvals;
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
