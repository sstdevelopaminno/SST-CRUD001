"use server";

import { revalidatePath } from "next/cache";

import { assertPermission } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

export async function uploadDocumentAction(formData: FormData) {
  await assertPermission("documents:view");

  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null) ?? "Untitled";

  if (!file) {
    return { ok: false, message: "File is required" };
  }

  const supabase = createClient();

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured" };
  }

  const user = await assertPermission("documents:view");
  const filePath = `${user.id}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) {
    return { ok: false, message: uploadError.message };
  }

  const { error: insertError } = await supabase.from("documents").insert({
    title,
    file_path: filePath,
    file_type: file.type,
    file_size: file.size,
    uploaded_by: user.id,
  });

  if (insertError) {
    return { ok: false, message: insertError.message };
  }

  await logAuditEvent({
    action_type: "document_uploaded",
    entity_type: "documents",
    entity_id: filePath,
    metadata: { title, size: file.size, type: file.type },
  });

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

  const { error } = await supabase.from("signatures").insert({
    document_id: payload.document_id,
    signer_id: user.id,
    signature_data_url: payload.signature_data_url,
    device_info: "browser",
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  await logAuditEvent({
    action_type: "document_signed",
    entity_type: "documents",
    entity_id: payload.document_id,
  });

  return { ok: true, message: "Signed" };
}
