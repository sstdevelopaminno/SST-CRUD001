"use server";

import { revalidatePath } from "next/cache";

import { assertPermission } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit";
import { createInAppNotification } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function sanitizeStorageFileName(fileName: string) {
  const normalized = fileName.normalize("NFKD").trim();
  const extensionMatch = normalized.match(/\.([^.]+)$/);
  const extension = extensionMatch ? `.${extensionMatch[1].toLowerCase().replace(/[^a-z0-9]/g, "")}` : "";
  const baseName = extensionMatch ? normalized.slice(0, -extensionMatch[0].length) : normalized;
  const safeBaseName = baseName
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `${safeBaseName || "document"}${extension}`;
}

function canDeleteAnyDocument(role: string) {
  return role === "CEO" || role === "IT";
}

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

  const serviceSupabase = createServiceClient();
  const storageClient = serviceSupabase ?? supabase;

  const safeFileName = sanitizeStorageFileName(file.name);
  const filePath = `${user.id}/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await storageClient.storage.from("documents").upload(filePath, file, {
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
    .select("id, title, file_type, uploaded_by")
    .single();

  if (insertError) {
    return { ok: false, message: insertError.message };
  }

  const { data: signedData } = await storageClient.storage.from("documents").createSignedUrl(filePath, 60 * 30);

  void logAuditEvent({
    action_type: "document_uploaded",
    entity_type: "documents",
    entity_id: insertedDocument?.id ?? filePath,
    metadata: { title, size: file.size, type: file.type },
  }).catch(() => undefined);

  revalidatePath("/documents");

  return {
    ok: true,
    message: "Uploaded",
    document: {
      id: insertedDocument.id,
      title: insertedDocument.title,
      type: insertedDocument.file_type || file.type || "file",
      signed: false,
      uploader: user.full_name || insertedDocument.uploaded_by,
      preview_url: signedData?.signedUrl ?? null,
    },
  };
}

export async function deleteDocumentAction(payload: { document_id: string }) {
  const user = await assertPermission("documents:view");

  const supabase = createClient();

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured" };
  }

  const serviceSupabase = createServiceClient();

  if (!serviceSupabase) {
    return { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY is required to delete documents" };
  }

  const { data: targetDocument, error: findError } = await serviceSupabase
    .from("documents")
    .select("id, title, file_path, uploaded_by")
    .eq("id", payload.document_id)
    .single();

  if (findError || !targetDocument) {
    return { ok: false, message: findError?.message ?? "Document not found" };
  }

  const canDelete = targetDocument.uploaded_by === user.id || canDeleteAnyDocument(user.role);

  if (!canDelete) {
    return { ok: false, message: "You can only delete your own document" };
  }

  const { error: deleteRowError } = await serviceSupabase.from("documents").delete().eq("id", targetDocument.id);

  if (deleteRowError) {
    return { ok: false, message: deleteRowError.message };
  }

  const { error: deleteFileError } = await serviceSupabase.storage.from("documents").remove([targetDocument.file_path]);

  if (deleteFileError) {
    void logAuditEvent({
      action_type: "document_deleted_file_cleanup_failed",
      entity_type: "documents",
      entity_id: targetDocument.id,
      metadata: { error: deleteFileError.message, file_path: targetDocument.file_path },
    }).catch(() => undefined);
  }

  void logAuditEvent({
    action_type: "document_deleted",
    entity_type: "documents",
    entity_id: targetDocument.id,
    metadata: { title: targetDocument.title, by: user.id },
  }).catch(() => undefined);

  revalidatePath("/documents");

  return { ok: true, message: "Deleted" };
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

  const serviceSupabase = createServiceClient();
  const readClient = serviceSupabase ?? supabase;

  const [{ data: document }, { data: existingSignature }] = await Promise.all([
    readClient.from("documents").select("id, title, uploaded_by").eq("id", payload.document_id).single(),
    readClient.from("signatures").select("id").eq("document_id", payload.document_id).eq("signer_id", user.id).maybeSingle(),
  ]);

  const signaturePayload = {
    document_id: payload.document_id,
    signer_id: user.id,
    signature_data_url: payload.signature_data_url,
    device_info: "browser",
  };

  if (serviceSupabase) {
    const { error } = await serviceSupabase.from("signatures").upsert(signaturePayload, {
      onConflict: "document_id,signer_id",
    });

    if (error) {
      return { ok: false, message: error.message };
    }
  } else {
    const { error } = await supabase.from("signatures").insert(signaturePayload);

    if (error) {
      if (error.code === "23505") {
        return { ok: true, message: "Already signed" };
      }

      return { ok: false, message: error.message };
    }
  }

  const isNewSignature = !existingSignature?.id;

  if (isNewSignature) {
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
  }

  revalidatePath("/documents");

  return { ok: true, message: "Signed" };
}
