import { createClient } from "@/lib/supabase/server";
import { documents } from "@/services/mock-data";

export async function getDocuments() {
  const supabase = createClient();

  if (!supabase) {
    return documents;
  }

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, file_type, uploaded_by")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return documents;
  }

  return data.map((item) => ({
    id: item.id,
    title: item.title,
    type: item.file_type,
    signed: false,
    uploader: item.uploaded_by,
  }));
}
