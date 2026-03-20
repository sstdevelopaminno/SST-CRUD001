"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { assertPermission } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit";
import { resolveRole } from "@/lib/rbac";
import { createServiceClient } from "@/lib/supabase/service";

const roleSchema = z.enum(["CEO", "MANAGER", "HEAD", "STAFF", "IT"]);
const uuidSchema = z.string().uuid();
const userIdSchema = z.string().min(1).max(120);

const createUserSchema = z.object({
  full_name: z.string().min(2).max(120),
  email: z.string().email(),
  role: roleSchema,
  department: z.string().max(120).optional().nullable(),
  password: z.string().min(8).max(72),
  active: z.boolean().default(true),
});

const updateUserSchema = z.object({
  id: userIdSchema,
  full_name: z.string().min(2).max(120),
  email: z.string().email(),
  role: roleSchema,
  department: z.string().max(120).optional().nullable(),
  active: z.boolean(),
  password: z.string().min(8).max(72).optional(),
});

const deleteUserSchema = z.object({
  id: userIdSchema,
});

function normalizeDepartment(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isUuid(value: string) {
  return uuidSchema.safeParse(value).success;
}

export async function createAdminUserAction(payload: unknown) {
  const actor = await assertPermission("admin:manage");

  const parsed = createUserSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: "Invalid user payload" };
  }

  const department = normalizeDepartment(parsed.data.department);
  const supabase = createServiceClient();

  if (!supabase) {
    const id = randomUUID();

    return {
      ok: true,
      user: {
        id,
        name: parsed.data.full_name,
        email: parsed.data.email,
        role: resolveRole(parsed.data.role),
        department: department ?? "-",
        active: parsed.data.active,
      },
    };
  }

  const { data: authResult, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      department,
    },
  });

  if (authError || !authResult.user) {
    return { ok: false, message: authError?.message ?? "Unable to create auth user" };
  }

  const { data: row, error: upsertError } = await supabase
    .from("users")
    .upsert(
      {
        id: authResult.user.id,
        email: parsed.data.email,
        full_name: parsed.data.full_name,
        role: parsed.data.role,
        department,
        active: parsed.data.active,
      },
      { onConflict: "id" },
    )
    .select("id, full_name, email, role, department, active")
    .single();

  if (upsertError || !row) {
    await supabase.auth.admin.deleteUser(authResult.user.id).catch(() => undefined);
    return { ok: false, message: upsertError?.message ?? "Unable to create user profile" };
  }

  void logAuditEvent({
    action_type: "admin_user_created",
    entity_type: "users",
    entity_id: row.id,
    metadata: { actor_id: actor.id, email: row.email, role: row.role },
  }).catch(() => undefined);

  return {
    ok: true,
    user: {
      id: row.id,
      name: row.full_name,
      email: row.email,
      role: resolveRole(row.role),
      department: row.department ?? "-",
      active: row.active,
    },
  };
}

export async function updateAdminUserAction(payload: unknown) {
  const actor = await assertPermission("admin:manage");

  const parsed = updateUserSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: "Invalid user payload" };
  }

  if (parsed.data.id === actor.id && !parsed.data.active) {
    return { ok: false, message: "You cannot deactivate your own account" };
  }

  const department = normalizeDepartment(parsed.data.department);
  const supabase = createServiceClient();

  if (!supabase || !isUuid(parsed.data.id)) {
    return {
      ok: true,
      user: {
        id: parsed.data.id,
        name: parsed.data.full_name,
        email: parsed.data.email,
        role: resolveRole(parsed.data.role),
        department: department ?? "-",
        active: parsed.data.active,
      },
    };
  }

  const { password, ...profileData } = parsed.data;

  const { error: authError } = await supabase.auth.admin.updateUserById(parsed.data.id, {
    email: profileData.email,
    ...(password ? { password } : {}),
    user_metadata: {
      full_name: profileData.full_name,
      role: profileData.role,
      department,
    },
  });

  if (authError) {
    return { ok: false, message: authError.message };
  }

  const { data: row, error: updateError } = await supabase
    .from("users")
    .update({
      email: profileData.email,
      full_name: profileData.full_name,
      role: profileData.role,
      department,
      active: profileData.active,
    })
    .eq("id", profileData.id)
    .select("id, full_name, email, role, department, active")
    .single();

  if (updateError || !row) {
    return { ok: false, message: updateError?.message ?? "Unable to update user profile" };
  }

  void logAuditEvent({
    action_type: "admin_user_updated",
    entity_type: "users",
    entity_id: row.id,
    metadata: { actor_id: actor.id, email: row.email, role: row.role, active: row.active },
  }).catch(() => undefined);

  return {
    ok: true,
    user: {
      id: row.id,
      name: row.full_name,
      email: row.email,
      role: resolveRole(row.role),
      department: row.department ?? "-",
      active: row.active,
    },
  };
}

export async function deleteAdminUserAction(payload: unknown) {
  const actor = await assertPermission("admin:manage");

  const parsed = deleteUserSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: "Invalid request" };
  }

  if (parsed.data.id === actor.id) {
    return { ok: false, message: "You cannot delete your own account" };
  }

  const supabase = createServiceClient();

  if (!supabase || !isUuid(parsed.data.id)) {
    return { ok: true };
  }

  const { error } = await supabase.auth.admin.deleteUser(parsed.data.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  void logAuditEvent({
    action_type: "admin_user_deleted",
    entity_type: "users",
    entity_id: parsed.data.id,
    metadata: { actor_id: actor.id },
  }).catch(() => undefined);

  return { ok: true };
}
