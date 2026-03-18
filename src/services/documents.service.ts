import { createClient } from "@/lib/supabase/server";
import { documents } from "@/services/mock-data";

const DEFAULT_LIMIT = 100;

export async function getDocuments(limit = DEFAULT_LIMIT) {
  const supabase = createClient();

  if (!supabase) {
    return documents.slice(0, limit);
  }

  const safeLimit = Math.min(Math.max(limit, 1), 200);

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, file_type, uploaded_by")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error || !data) {
    return documents.slice(0, safeLimit);
  }

  return data.map((item) => ({
    id: item.id,
    title: item.title,
    type: item.file_type,
    signed: false,
    uploader: item.uploaded_by,
  }));
}
