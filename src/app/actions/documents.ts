"use server";

import { revalidatePath } from "next/cache";

import { assertPermission } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit";
import { createInAppNotification } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

export async function uploadDocumentAction(formData: FormData) {
  const user = await assertPermission("documents:view");

  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null) ?? "Untitled";

  if (!file) {
    return { ok: false, message: "File is required" };
  }

  const supabase = createClient();

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured" };
  }

  const filePath = `${user.id}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) {
    return { ok: false, message: uploadError.message };
  }

  const { data: insertedDocument, error: insertError } = await supabase
    .from("documents")
    .insert({
      title,
      file_path: filePath,
      file_type: file.type,
      file_size: file.size,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (insertError) {
    return { ok: false, message: insertError.message };
  }

  void logAuditEvent({
    action_type: "document_uploaded",
    entity_type: "documents",
    entity_id: insertedDocument?.id ?? filePath,
    metadata: { title, size: file.size, type: file.type },
  }).catch(() => undefined);

  revalidatePath("/documents");

  return { ok: true, message: "Uploaded" };
}

export async function saveSignatureAction(payload: {
  document_id: string;
  signature_data_url: string;
}) {
  const user = await assertPermission("documents:sign");

  const supabase = createClient();

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured" };
  }

  const { data: document } = await supabase.from("documents").select("id, title, uploaded_by").eq("id", payload.document_id).single();

  const { error } = await supabase.from("signatures").insert({
    document_id: payload.document_id,
    signer_id: user.id,
    signature_data_url: payload.signature_data_url,
    device_info: "browser",
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  void logAuditEvent({
    action_type: "document_signed",
    entity_type: "documents",
    entity_id: payload.document_id,
  }).catch(() => undefined);

  if (document?.uploaded_by && document.uploaded_by !== user.id) {
    void createInAppNotification(
      document.uploaded_by,
      "Document signed",
      `${document.title} has been signed by ${user.full_name}.`,
    ).catch(() => undefined);
  }

  return { ok: true, message: "Signed" };
}
