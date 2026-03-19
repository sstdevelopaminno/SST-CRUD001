"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertPermission } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const projectStatusSchema = z.enum(["todo", "in_progress", "doing", "done", "active"]);
const transferDecisionSchema = z.enum(["approved", "rejected"]);
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

const createProjectSchema = z.object({
  name: z.string().min(2).max(160),
  description: z.string().max(500).optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(),
  owner_id: z.string().uuid().optional().nullable(),
  status: projectStatusSchema.default("todo"),
  due_date: z.string().optional().nullable(),
  commission_rate: z.coerce.number().min(0).max(100).default(0),
  active: z.boolean().default(true),
  is_template: z.boolean().default(true),
  require_customer_name: z.boolean().default(true),
  require_customer_phone: z.boolean().default(true),
  require_customer_address: z.boolean().default(false),
  require_face_photo: z.boolean().default(false),
  require_id_card: z.boolean().default(false),
  require_id_address: z.boolean().default(false),
});

const updateProjectCommissionSchema = z.object({
  project_id: z.string().uuid(),
  commission_rate: z.coerce.number().min(0).max(100),
});

const requestTransferSchema = z.object({
  project_case_id: z.string().uuid(),
  to_sales_id: z.string().uuid(),
  reason: z.string().max(500).optional().nullable(),
});

const reviewTransferSchema = z.object({
  transfer_id: z.string().uuid(),
  decision: transferDecisionSchema,
});

function roundRate(value: number) {
  return Math.round(value * 100) / 100;
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

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function calculateCommissionCycleWindow(openedAt: Date) {
  const year = openedAt.getUTCFullYear();
  const month = openedAt.getUTCMonth();
  const day = openedAt.getUTCDate();

  const periodStart = day >= 15 ? new Date(Date.UTC(year, month, 15)) : new Date(Date.UTC(year, month, 1));
  const periodEnd = day >= 15 ? new Date(Date.UTC(year, month + 1, 14)) : new Date(Date.UTC(year, month + 1, 0));
  const payoutWindowStart = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() + 1, 5));
  const payoutWindowEnd = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() + 1, 10));

  return {
    periodStart: toDateOnly(periodStart),
    periodEnd: toDateOnly(periodEnd),
    payoutWindowStart: toDateOnly(payoutWindowStart),
    payoutWindowEnd: toDateOnly(payoutWindowEnd),
  };
}

function normalizeSchemaMessage(message: string) {
  const lowered = message.toLowerCase();

  if (lowered.includes("commission_rate") && lowered.includes("column")) {
    return "Database schema is outdated. Please run latest supabase/schema.sql";
  }

  if (lowered.includes("project_cases") || lowered.includes("project_case_transfers") || lowered.includes("relation")) {
    return "Database schema is outdated. Please run latest supabase/schema.sql";
  }

  if (lowered.includes("idx_project_case_transfer_pending")) {
    return "There is already a pending transfer request for this sales case";
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

type ProjectCaseStorageClient = NonNullable<ReturnType<typeof createClient>> | NonNullable<ReturnType<typeof createServiceClient>>;

async function uploadProjectCaseFile(
  storageClient: ProjectCaseStorageClient,
  userId: string,
  caseId: string,
  file: File,
  slot: "face" | "id-card",
) {
  const safeFileName = sanitizeStorageFileName(file.name || `${slot}.bin`);
  const filePath = `project-cases/${userId}/${caseId}/${Date.now()}-${slot}-${safeFileName}`;

  const { error } = await storageClient.storage.from("documents").upload(filePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });

  if (error) {
    return { ok: false as const, message: error.message };
  }

  return { ok: true as const, filePath };
}

export async function createProjectAction(payload: unknown) {
  const actor = await assertPermission("projects:edit");

  if (actor.role !== "CEO") {
    return { ok: false, message: "Only CEO can create projects" };
  }

  const parsed = createProjectSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: "Invalid project payload" };
  }

  const supabase = createClient();
  const commissionRate = roundRate(parsed.data.commission_rate);
  const dueDate = normalizeOptionalDate(parsed.data.due_date);

  const insertPayload = {
    name: parsed.data.name.trim(),
    description: normalizeOptionalText(parsed.data.description),
    customer_id: parsed.data.customer_id ?? null,
    owner_id: parsed.data.owner_id ?? null,
    status: parsed.data.status,
    due_date: dueDate,
    commission_rate: commissionRate,
    active: parsed.data.active,
    is_template: parsed.data.is_template,
    require_customer_name: parsed.data.require_customer_name,
    require_customer_phone: parsed.data.require_customer_phone,
    require_customer_address: parsed.data.require_customer_address,
    require_face_photo: parsed.data.require_face_photo,
    require_id_card: parsed.data.require_id_card,
    require_id_address: parsed.data.require_id_address,
  };

  if (!supabase) {
    return {
      ok: true,
      project: {
        id: randomUUID(),
        ...insertPayload,
        created_at: new Date().toISOString(),
      },
    };
  }

  const { data, error } = await supabase
    .from("projects")
    .insert(insertPayload)
    .select(
      "id, name, description, status, owner_id, customer_id, due_date, commission_rate, active, is_template, require_customer_name, require_customer_phone, require_customer_address, require_face_photo, require_id_card, require_id_address, created_at",
    )
    .single();

  if (error || !data) {
    const message = normalizeSchemaMessage(error?.message ?? "Unable to create project");
    return { ok: false, message };
  }

  void logAuditEvent({
    action_type: "project_created_by_ceo",
    entity_type: "projects",
    entity_id: data.id,
    metadata: {
      actor_id: actor.id,
      project_name: data.name,
      status: data.status,
      commission_rate: data.commission_rate,
    },
  }).catch(() => undefined);

  revalidatePath("/projects");
  revalidatePath("/dashboard");

  return { ok: true, project: data };
}

export async function createProjectCaseAction(formData: FormData) {
  const actor = await assertPermission("projects:view");
  const supabase = createClient();

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured" };
  }

  if (actor.role !== "STAFF" && actor.role !== "CEO") {
    return { ok: false, message: "Only sales staff can open project cases" };
  }

  const projectId = String(formData.get("project_id") ?? "").trim();

  if (!projectId) {
    return { ok: false, message: "Project is required" };
  }

  const { data: template, error: templateError } = await supabase
    .from("projects")
    .select(
      "id, name, commission_rate, active, is_template, require_customer_name, require_customer_phone, require_customer_address, require_face_photo, require_id_card, require_id_address",
    )
    .eq("id", projectId)
    .single();

  if (templateError || !template) {
    return { ok: false, message: normalizeSchemaMessage(templateError?.message ?? "Project template not found") };
  }

  if (!template.active || !template.is_template) {
    return { ok: false, message: "This project is not available for sales opening" };
  }

  const customerName = normalizeOptionalText(formData.get("customer_name") as string | null);
  const customerPhone = normalizeOptionalText(formData.get("customer_phone") as string | null);
  const customerAddress = normalizeOptionalText(formData.get("customer_address") as string | null);
  const customerIdAddress = normalizeOptionalText(formData.get("customer_id_address") as string | null);

  const facePhoto = formData.get("customer_face_photo") as File | null;
  const idCardPhoto = formData.get("customer_id_card") as File | null;

  if (facePhoto && facePhoto.size > MAX_UPLOAD_SIZE_BYTES) {
    return { ok: false, message: "Customer face photo must be 5MB or less" };
  }

  if (idCardPhoto && idCardPhoto.size > MAX_UPLOAD_SIZE_BYTES) {
    return { ok: false, message: "Customer ID card image must be 5MB or less" };
  }

  if (template.require_customer_name && !customerName) {
    return { ok: false, message: "Customer name is required" };
  }

  if (template.require_customer_phone && !customerPhone) {
    return { ok: false, message: "Customer phone is required" };
  }

  if (template.require_customer_address && !customerAddress) {
    return { ok: false, message: "Customer address is required" };
  }

  if (template.require_id_address && !customerIdAddress) {
    return { ok: false, message: "ID-card address is required" };
  }

  if (template.require_face_photo && (!facePhoto || facePhoto.size <= 0)) {
    return { ok: false, message: "Customer face photo is required" };
  }

  if (template.require_id_card && (!idCardPhoto || idCardPhoto.size <= 0)) {
    return { ok: false, message: "Customer ID card image is required" };
  }

  let customerId: string | null = null;

  if (customerName) {
    const { data: insertedCustomer, error: customerError } = await supabase
      .from("customers")
      .insert({
        name: customerName,
        phone: customerPhone,
        status: "prospect",
        owner_id: actor.id,
      })
      .select("id")
      .single();

    if (!customerError && insertedCustomer) {
      customerId = insertedCustomer.id;
    }
  }

  const caseId = randomUUID();
  const serviceSupabase = createServiceClient();
  const storageClient = serviceSupabase ?? supabase;

  let facePath: string | null = null;
  let idCardPath: string | null = null;

  if (facePhoto && facePhoto.size > 0) {
    const uploadResult = await uploadProjectCaseFile(storageClient, actor.id, caseId, facePhoto, "face");

    if (!uploadResult.ok) {
      return { ok: false, message: uploadResult.message };
    }

    facePath = uploadResult.filePath;
  }

  if (idCardPhoto && idCardPhoto.size > 0) {
    const uploadResult = await uploadProjectCaseFile(storageClient, actor.id, caseId, idCardPhoto, "id-card");

    if (!uploadResult.ok) {
      return { ok: false, message: uploadResult.message };
    }

    idCardPath = uploadResult.filePath;
  }

  const openedAt = new Date();
  const cycleWindow = calculateCommissionCycleWindow(openedAt);

  const { data: createdCase, error: caseError } = await supabase
    .from("project_cases")
    .insert({
      id: caseId,
      project_id: template.id,
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      customer_face_photo_path: facePath,
      customer_id_card_path: idCardPath,
      customer_id_address: customerIdAddress,
      opened_by: actor.id,
      sales_owner_id: actor.id,
      commission_owner_id: actor.id,
      commission_rate: roundRate(template.commission_rate ?? 0),
      approval_status: "pending",
      lifecycle_status: "open",
      opened_at: openedAt.toISOString(),
      commission_period_start: cycleWindow.periodStart,
      commission_period_end: cycleWindow.periodEnd,
      commission_payout_window_start: cycleWindow.payoutWindowStart,
      commission_payout_window_end: cycleWindow.payoutWindowEnd,
      extra_data: {
        template_name: template.name,
      },
    })
    .select(
      "id, project_id, sales_owner_id, commission_owner_id, commission_rate, approval_status, lifecycle_status, opened_at, commission_period_start, commission_period_end, commission_payout_window_start, commission_payout_window_end, created_at",
    )
    .single();

  if (caseError || !createdCase) {
    return { ok: false, message: normalizeSchemaMessage(caseError?.message ?? "Unable to open project case") };
  }

  void logAuditEvent({
    action_type: "project_case_opened",
    entity_type: "project_cases",
    entity_id: createdCase.id,
    metadata: {
      actor_id: actor.id,
      project_id: template.id,
      customer_name: customerName,
      commission_rate: createdCase.commission_rate,
    },
  }).catch(() => undefined);

  revalidatePath("/projects");
  revalidatePath("/dashboard");

  return { ok: true, project_case: createdCase };
}

export async function requestProjectTransferAction(payload: unknown) {
  const actor = await assertPermission("projects:view");
  const parsed = requestTransferSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: "Invalid transfer payload" };
  }

  if (parsed.data.to_sales_id === actor.id) {
    return { ok: false, message: "Cannot transfer to yourself" };
  }

  const supabase = createClient();

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured" };
  }

  const { data: projectCase, error: caseError } = await supabase
    .from("project_cases")
    .select("id, sales_owner_id, lifecycle_status")
    .eq("id", parsed.data.project_case_id)
    .single();

  if (caseError || !projectCase) {
    return { ok: false, message: normalizeSchemaMessage(caseError?.message ?? "Project case not found") };
  }

  const canRequest = actor.role === "CEO" || projectCase.sales_owner_id === actor.id;

  if (!canRequest) {
    return { ok: false, message: "Only current owner can request transfer" };
  }

  const { data: transfer, error: transferError } = await supabase
    .from("project_case_transfers")
    .insert({
      project_case_id: projectCase.id,
      from_sales_id: projectCase.sales_owner_id,
      to_sales_id: parsed.data.to_sales_id,
      reason: normalizeOptionalText(parsed.data.reason),
      status: "pending",
      requested_by: actor.id,
    })
    .select("id")
    .single();

  if (transferError || !transfer) {
    return { ok: false, message: normalizeSchemaMessage(transferError?.message ?? "Unable to create transfer request") };
  }

  await supabase
    .from("project_cases")
    .update({ lifecycle_status: "handover_pending" })
    .eq("id", projectCase.id);

  void logAuditEvent({
    action_type: "project_transfer_requested",
    entity_type: "project_case_transfers",
    entity_id: transfer.id,
    metadata: {
      actor_id: actor.id,
      project_case_id: projectCase.id,
      from_sales_id: projectCase.sales_owner_id,
      to_sales_id: parsed.data.to_sales_id,
    },
  }).catch(() => undefined);

  revalidatePath("/projects");

  return { ok: true, transfer_id: transfer.id };
}

export async function reviewProjectTransferAction(payload: unknown) {
  const actor = await assertPermission("projects:edit");

  if (actor.role !== "CEO" && actor.role !== "MANAGER" && actor.role !== "HEAD") {
    return { ok: false, message: "Only CEO, MANAGER, or HEAD can review transfer requests" };
  }

  const parsed = reviewTransferSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: "Invalid transfer review payload" };
  }

  const supabase = createClient();

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured" };
  }

  const { data: transfer, error: transferError } = await supabase
    .from("project_case_transfers")
    .select("id, project_case_id, to_sales_id, status")
    .eq("id", parsed.data.transfer_id)
    .single();

  if (transferError || !transfer) {
    return { ok: false, message: normalizeSchemaMessage(transferError?.message ?? "Transfer request not found") };
  }

  if (transfer.status !== "pending") {
    return { ok: false, message: "This transfer request has already been reviewed" };
  }

  const nowIso = new Date().toISOString();

  const { error: updateTransferError } = await supabase
    .from("project_case_transfers")
    .update({
      status: parsed.data.decision,
      approver_id: actor.id,
      approver_role: actor.role,
      approved_at: nowIso,
    })
    .eq("id", transfer.id);

  if (updateTransferError) {
    return { ok: false, message: updateTransferError.message };
  }

  if (parsed.data.decision === "approved") {
    const { error: updateCaseError } = await supabase
      .from("project_cases")
      .update({
        sales_owner_id: transfer.to_sales_id,
        commission_owner_id: transfer.to_sales_id,
        lifecycle_status: "in_progress",
        approval_status: "approved",
      })
      .eq("id", transfer.project_case_id);

    if (updateCaseError) {
      return { ok: false, message: normalizeSchemaMessage(updateCaseError.message) };
    }
  } else {
    await supabase
      .from("project_cases")
      .update({
        lifecycle_status: "in_progress",
        approval_status: "rejected",
      })
      .eq("id", transfer.project_case_id);

  }

  void logAuditEvent({
    action_type: "project_transfer_reviewed",
    entity_type: "project_case_transfers",
    entity_id: transfer.id,
    metadata: {
      actor_id: actor.id,
      decision: parsed.data.decision,
      project_case_id: transfer.project_case_id,
    },
  }).catch(() => undefined);

  revalidatePath("/projects");

  return { ok: true };
}

export async function updateProjectCommissionRateAction(payload: unknown) {
  const actor = await assertPermission("projects:edit");

  if (actor.role !== "CEO") {
    return { ok: false, message: "Only CEO can manage commission rates" };
  }

  const parsed = updateProjectCommissionSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: "Invalid commission payload" };
  }

  const commissionRate = roundRate(parsed.data.commission_rate);
  const supabase = createClient();

  if (!supabase) {
    return {
      ok: true,
      project: {
        id: parsed.data.project_id,
        commission_rate: commissionRate,
      },
    };
  }

  const { data, error } = await supabase
    .from("projects")
    .update({ commission_rate: commissionRate })
    .eq("id", parsed.data.project_id)
    .select("id, name")
    .single();

  if (error || !data) {
    const message = normalizeSchemaMessage(error?.message ?? "Unable to update commission rate");
    return { ok: false, message };
  }

  await supabase
    .from("project_cases")
    .update({ commission_rate: commissionRate })
    .eq("project_id", parsed.data.project_id)
    .in("lifecycle_status", ["open", "in_progress", "handover_pending"]);

  void logAuditEvent({
    action_type: "project_commission_rate_updated",
    entity_type: "projects",
    entity_id: data.id,
    metadata: {
      actor_id: actor.id,
      project_name: data.name,
      commission_rate: commissionRate,
    },
  }).catch(() => undefined);

  revalidatePath("/projects");
  revalidatePath("/dashboard");

  return {
    ok: true,
    project: {
      id: data.id,
      name: data.name,
      commission_rate: commissionRate,
    },
  };
}





const serverListQuerySchema = z.object({
  page_size: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(120).optional().nullable(),
  cursor: z.string().max(512).optional().nullable(),
});

export async function getProjectTemplatesPageAction(payload: unknown) {
  const actor = await assertPermission("projects:view");

  if (actor.role !== "CEO") {
    return { ok: false, message: "Only CEO can view project template table" };
  }

  const parsed = serverListQuerySchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: "Invalid list query" };
  }

  const { getProjectTemplatesPage } = await import("@/services/projects.service");
  const data = await getProjectTemplatesPage({
    pageSize: parsed.data.page_size,
    search: parsed.data.search,
    cursor: parsed.data.cursor,
  });

  return { ok: true, data };
}

export async function getProjectCasesPageAction(payload: unknown) {
  const actor = await assertPermission("projects:view");

  if (actor.role !== "CEO") {
    return { ok: false, message: "Only CEO can view project case table" };
  }

  const parsed = serverListQuerySchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: "Invalid list query" };
  }

  const { getProjectCasesPage } = await import("@/services/projects.service");
  const data = await getProjectCasesPage({
    pageSize: parsed.data.page_size,
    search: parsed.data.search,
    cursor: parsed.data.cursor,
  });

  return { ok: true, data };
}

export async function getProjectTransfersPageAction(payload: unknown) {
  const actor = await assertPermission("projects:view");

  if (actor.role !== "CEO") {
    return { ok: false, message: "Only CEO can view transfer queue table" };
  }

  const parsed = serverListQuerySchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: "Invalid list query" };
  }

  const { getProjectTransfersPage } = await import("@/services/projects.service");
  const data = await getProjectTransfersPage({
    pageSize: parsed.data.page_size,
    search: parsed.data.search,
    cursor: parsed.data.cursor,
  });

  return { ok: true, data };
}
