import { createClient } from "@/lib/supabase/server";
import { jobs } from "@/services/mock-data";

const DEFAULT_LIMIT = 100;

export async function getJobs(limit = DEFAULT_LIMIT) {
  const supabase = createClient();

  if (!supabase) {
    return jobs.slice(0, limit);
  }

  const safeLimit = Math.min(Math.max(limit, 1), 200);

  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, assignee_id, priority, status")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error || !data) {
    return jobs.slice(0, safeLimit);
  }

  return data.map((item) => ({
    id: item.id,
    title: item.title,
    assignee: item.assignee_id ?? "Unassigned",
    priority: item.priority,
    status: item.status,
  }));
}
