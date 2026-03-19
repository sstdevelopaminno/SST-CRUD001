"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertPermission } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const cycleStatusSchema = z.enum(["draft", "submitted", "approved", "rejected", "paid"]);

const createProfileSchema = z.object({
  user_id: z.string().uuid().optional().nullable(),
  employee_code: z.string().max(50).optional().nullable(),
  full_name: z.string().min(2).max(200),
  phone: z.string().max(50).optional().nullable(),
  current_address: z.string().max(500).optional().nullable(),
  id_card_address: z.string().max(500).optional().nullable(),
  id_card_number: z.string().max(50).optional().nullable(),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  manager_user_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const createCycleSchema = z.object({
  sales_profile_id: z.string().uuid(),
  cycle_label: z.string().max(120).optional().nullable(),
  period_start: z.string(),
  period_end: z.string(),
  payout_window_start: z.string(),
  payout_window_end: z.string(),
  gross_sales: z.coerce.number().min(0).default(0),
  approved_sales: z.coerce.number().min(0).default(0),
  commission_rate_avg: z.coerce.number().min(0).max(100).default(0),
  commission_amount: z.coerce.number().min(0).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

const updateCycleStatusSchema = z.object({
  cycle_id: z.string().uuid(),
  status: cycleStatusSchema,
  notes: z.string().max(1000).optional().nullable(),
});

type SalesStorageClient = NonNullable<ReturnType<typeof createClient>> | NonNullable<ReturnType<typeof createServiceClient>>;
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalDate(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function normalizeSchemaMessage(message: string) {
  const lowered = message.toLowerCase();

  if (lowered.includes("sales_profiles") || lowered.includes("sales_profile_documents") || lowered.includes("sales_commission_cycles")) {
    return "Database schema is outdated. Please run latest supabase/schema.sql";
  }

  return message;
}

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

  return `${safeBaseName || "file"}${extension}`;
}

async function uploadProfileDocument(
  storageClient: SalesStorageClient,
  profileId: string,
  type: "portrait" | "id_card_front" | "id_card_back",
  file: File,
) {
  const safeFileName = sanitizeStorageFileName(file.name || `${type}.bin`);
  const filePath = `sales-profiles/${profileId}/${Date.now()}-${type}-${safeFileName}`;

  const { error } = await storageClient.storage.from("documents").upload(filePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });

  if (error) {
    return { ok: false as const, message: error.message };
  }

  return { ok: true as const, filePath, fileName: file.name || safeFileName, mimeType: file.type || "application/octet-stream" };
}

export async function createSalesProfileAction(formData: FormData) {
  const actor = await assertPermission("sales:manage");
  const supabase = createClient();

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured" };
  }

  const parsed = createProfileSchema.safeParse({
    user_id: normalizeOptionalText(String(formData.get("user_id") ?? "")),
    employee_code: normalizeOptionalText(String(formData.get("employee_code") ?? "")),
    full_name: String(formData.get("full_name") ?? "").trim(),
    phone: normalizeOptionalText(String(formData.get("phone") ?? "")),
    current_address: normalizeOptionalText(String(formData.get("current_address") ?? "")),
    id_card_address: normalizeOptionalText(String(formData.get("id_card_address") ?? "")),
    id_card_number: normalizeOptionalText(String(formData.get("id_card_number") ?? "")),
    status: String(formData.get("status") ?? "active"),
    start_date: normalizeOptionalDate(String(formData.get("start_date") ?? "")),
    end_date: normalizeOptionalDate(String(formData.get("end_date") ?? "")),
    manager_user_id: normalizeOptionalText(String(formData.get("manager_user_id") ?? "")),
    notes: normalizeOptionalText(String(formData.get("notes") ?? "")),
  });

  if (!parsed.success) {
    return { ok: false, message: "Invalid sales profile payload" };
  }

  const { data: insertedProfile, error: profileError } = await supabase
    .from("sales_profiles")
    .insert({
      user_id: parsed.data.user_id,
      employee_code: parsed.data.employee_code,
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      current_address: parsed.data.current_address,
      id_card_address: parsed.data.id_card_address,
      id_card_number: parsed.data.id_card_number,
      status: parsed.data.status,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      manager_user_id: parsed.data.manager_user_id,
      notes: parsed.data.notes,
      created_by: actor.id,
    })
    .select("id, full_name")
    .single();

  if (profileError || !insertedProfile) {
    return { ok: false, message: normalizeSchemaMessage(profileError?.message ?? "Unable to create sales profile") };
  }

  const serviceSupabase = createServiceClient();
  const storageClient = serviceSupabase ?? supabase;

  const fileSlots: Array<{ formKey: string; type: "portrait" | "id_card_front" | "id_card_back" }> = [
    { formKey: "portrait", type: "portrait" },
    { formKey: "id_card_front", type: "id_card_front" },
    { formKey: "id_card_back", type: "id_card_back" },
  ];

  for (const slot of fileSlots) {
    const file = formData.get(slot.formKey) as File | null;

    if (!file || file.size <= 0) {
      continue;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return { ok: false, message: "Uploaded image must be 5MB or less" };
    }

    const uploaded = await uploadProfileDocument(storageClient, insertedProfile.id, slot.type, file);

    if (!uploaded.ok) {
      return { ok: false, message: uploaded.message };
    }

    const { error: docError } = await supabase.from("sales_profile_documents").insert({
      id: randomUUID(),
      sales_profile_id: insertedProfile.id,
      document_type: slot.type,
      file_path: uploaded.filePath,
      file_name: uploaded.fileName,
      mime_type: uploaded.mimeType,
      uploaded_by: actor.id,
    });

    if (docError) {
      return { ok: false, message: normalizeSchemaMessage(docError.message) };
    }
  }

  void logAuditEvent({
    action_type: "sales_profile_created",
    entity_type: "sales_profiles",
    entity_id: insertedProfile.id,
    metadata: {
      actor_id: actor.id,
      full_name: insertedProfile.full_name,
    },
  }).catch(() => undefined);

  revalidatePath("/sales-team");

  return { ok: true, profile_id: insertedProfile.id };
}

export async function createSalesCommissionCycleAction(payload: unknown) {
  const actor = await assertPermission("sales:manage");
  const supabase = createClient();

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured" };
  }

  const parsed = createCycleSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: "Invalid commission cycle payload" };
  }

  const commissionAmount =
    typeof parsed.data.commission_amount === "number"
      ? parsed.data.commission_amount
      : Math.round(parsed.data.approved_sales * (parsed.data.commission_rate_avg / 100) * 100) / 100;

  const { data, error } = await supabase
    .from("sales_commission_cycles")
    .insert({
      sales_profile_id: parsed.data.sales_profile_id,
      cycle_label: normalizeOptionalText(parsed.data.cycle_label),
      period_start: parsed.data.period_start,
      period_end: parsed.data.period_end,
      payout_window_start: parsed.data.payout_window_start,
      payout_window_end: parsed.data.payout_window_end,
      gross_sales: parsed.data.gross_sales,
      approved_sales: parsed.data.approved_sales,
      commission_rate_avg: parsed.data.commission_rate_avg,
      commission_amount: commissionAmount,
      status: "draft",
      submitted_by: actor.id,
      notes: normalizeOptionalText(parsed.data.notes),
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: normalizeSchemaMessage(error?.message ?? "Unable to create commission cycle") };
  }

  void logAuditEvent({
    action_type: "sales_commission_cycle_created",
    entity_type: "sales_commission_cycles",
    entity_id: data.id,
    metadata: {
      actor_id: actor.id,
      sales_profile_id: parsed.data.sales_profile_id,
      period_start: parsed.data.period_start,
      period_end: parsed.data.period_end,
    },
  }).catch(() => undefined);

  revalidatePath("/sales-team");

  return { ok: true, cycle_id: data.id };
}

export async function updateSalesCommissionCycleStatusAction(payload: unknown) {
  const actor = await assertPermission("sales:manage");
  const supabase = createClient();

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured" };
  }

  const parsed = updateCycleStatusSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: "Invalid cycle status payload" };
  }

  const nowIso = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    status: parsed.data.status,
  };

  if (parsed.data.notes) {
    updatePayload.notes = parsed.data.notes;
  }

  if (parsed.data.status === "submitted") {
    updatePayload.submitted_by = actor.id;
  }

  if (parsed.data.status === "approved" || parsed.data.status === "rejected") {
    updatePayload.approved_by = actor.id;
    updatePayload.approved_at = nowIso;
  }

  if (parsed.data.status === "paid") {
    updatePayload.paid_at = nowIso;
  }

  const { error } = await supabase.from("sales_commission_cycles").update(updatePayload).eq("id", parsed.data.cycle_id);

  if (error) {
    return { ok: false, message: normalizeSchemaMessage(error.message) };
  }

  void logAuditEvent({
    action_type: "sales_commission_cycle_status_updated",
    entity_type: "sales_commission_cycles",
    entity_id: parsed.data.cycle_id,
    metadata: {
      actor_id: actor.id,
      status: parsed.data.status,
    },
  }).catch(() => undefined);

  revalidatePath("/sales-team");

  return { ok: true };
}




const serverSalesListQuerySchema = z.object({
  page_size: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(120).optional().nullable(),
  cursor: z.string().max(512).optional().nullable(),
});

export async function getSalesProfilesPageAction(payload: unknown) {
  await assertPermission("sales:view");

  const parsed = serverSalesListQuerySchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: "Invalid list query" };
  }

  const { getSalesProfilesPage } = await import("@/services/sales-team.service");
  const data = await getSalesProfilesPage({
    pageSize: parsed.data.page_size,
    search: parsed.data.search,
    cursor: parsed.data.cursor,
  });

  return { ok: true, data };
}

export async function getSalesCommissionCyclesPageAction(payload: unknown) {
  await assertPermission("sales:view");

  const parsed = serverSalesListQuerySchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: "Invalid list query" };
  }

  const { getSalesCommissionCyclesPage } = await import("@/services/sales-team.service");
  const data = await getSalesCommissionCyclesPage({
    pageSize: parsed.data.page_size,
    search: parsed.data.search,
    cursor: parsed.data.cursor,
  });

  return { ok: true, data };
}
