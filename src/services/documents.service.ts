import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { documents } from "@/services/mock-data";

const DEFAULT_LIMIT = 100;

interface SignedUrlRow {
  path?: string;
  signedUrl?: string | null;
}

export async function getDocuments(limit = DEFAULT_LIMIT) {
  const supabase = createClient();

  if (!supabase) {
    return documents.slice(0, limit).map((item) => ({
      ...item,
      preview_url: null,
    }));
  }

  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const privilegedClient = createServiceClient();
  const queryClient = privilegedClient ?? supabase;

  const { data, error } = await queryClient
    .from("documents")
    .select("id, title, file_type, uploaded_by, file_path")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error || !data) {
    return documents.slice(0, safeLimit).map((item) => ({
      ...item,
      preview_url: null,
    }));
  }

  const uploaderIds = Array.from(new Set(data.map((item) => item.uploaded_by)));
  const documentIds = data.map((item) => item.id);
  const filePaths = data.map((item) => item.file_path);

  const [{ data: usersData }, { data: signaturesData }, signedUrlsResult] = await Promise.all([
    uploaderIds.length > 0
      ? queryClient.from("users").select("id, full_name, email").in("id", uploaderIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string; email: string }> }),
    documentIds.length > 0
      ? queryClient.from("signatures").select("document_id").in("document_id", documentIds)
      : Promise.resolve({ data: [] as Array<{ document_id: string }> }),
    filePaths.length > 0
      ? queryClient.storage.from("documents").createSignedUrls(filePaths, 60 * 30)
      : Promise.resolve({ data: [] as SignedUrlRow[] }),
  ]);

  const nameById = new Map<string, string>();

  for (const user of usersData ?? []) {
    const displayName = user.full_name?.trim() || user.email?.trim() || user.id;
    nameById.set(user.id, displayName);
  }

  const signedDocumentIds = new Set((signaturesData ?? []).map((signature) => signature.document_id));
  const previewByPath = new Map<string, string | null>();

  for (const row of (signedUrlsResult.data ?? []) as SignedUrlRow[]) {
    if (!row.path) {
      continue;
    }

    previewByPath.set(row.path, row.signedUrl ?? null);
  }

  return data.map((item) => ({
    id: item.id,
    title: item.title,
    type: item.file_type,
    signed: signedDocumentIds.has(item.id),
    uploader: nameById.get(item.uploaded_by) ?? item.uploaded_by,
    preview_url: previewByPath.get(item.file_path) ?? null,
  }));
}
