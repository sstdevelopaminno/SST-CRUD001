import { createClient } from "@/lib/supabase/server";
import { jobs } from "@/services/mock-data";

export async function getJobs() {
  const supabase = createClient();

  if (!supabase) {
    return jobs;
  }

  const { data, error } = await supabase.from("jobs").select("id, title, assignee_id, priority, status").order("created_at", { ascending: false });

  if (error || !data) {
    return jobs;
  }

  return data.map((item) => ({
    id: item.id,
    title: item.title,
    assignee: item.assignee_id ?? "Unassigned",
    priority: item.priority,
    status: item.status,
  }));
}
