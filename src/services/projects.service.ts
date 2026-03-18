import { createClient } from "@/lib/supabase/server";
import { projectBoard } from "@/services/mock-data";

export async function getProjectBoard() {
  const supabase = createClient();

  if (!supabase) {
    return projectBoard;
  }

  const { data, error } = await supabase.from("projects").select("id, name, status, due_date, owner_id").order("created_at", { ascending: false });

  if (error || !data) {
    return projectBoard;
  }

  const grouped = {
    todo: [] as { id: string; name: string; owner: string; due: string | null }[],
    doing: [] as { id: string; name: string; owner: string; due: string | null }[],
    done: [] as { id: string; name: string; owner: string; due: string | null }[],
  };

  data.forEach((item) => {
    const status = item.status?.toLowerCase();
    const payload = { id: item.id, name: item.name, owner: item.owner_id ?? "Unassigned", due: item.due_date };

    if (status === "done") {
      grouped.done.push(payload);
      return;
    }

    if (status === "doing" || status === "in_progress") {
      grouped.doing.push(payload);
      return;
    }

    grouped.todo.push(payload);
  });

  return grouped;
}
