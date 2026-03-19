"use server";

import crypto from "crypto";

import { assertPermission } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit";
import { env } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/service";
import { apiConfigSchema, featureFlagSchema } from "@/lib/validators";
import { testApiConnection } from "@/services/api-config.service";

function encryptSecret(value: string) {
  const key = crypto.createHash("sha256").update(env.serviceRoleKey ?? "sst-fallback-key").digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export async function updateFeatureFlagAction(payload: unknown) {
  await assertPermission("it:manage");

  const parsed = featureFlagSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: "Invalid feature flag payload" };
  }

  const supabase = createServiceClient();

  if (!supabase) {
    return { ok: false, message: "Supabase service role is not configured" };
  }

  const { error } = await supabase.from("feature_flags").update({ enabled: parsed.data.enabled }).eq("id", parsed.data.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  void logAuditEvent({
    action_type: "feature_flag_updated",
    entity_type: "feature_flags",
    entity_id: parsed.data.id,
    metadata: { enabled: parsed.data.enabled },
  }).catch(() => undefined);

  return { ok: true, message: "Updated" };
}

export async function saveApiConfigAction(payload: unknown) {
  await assertPermission("it:manage");

  const parsed = apiConfigSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: "Invalid API config payload" };
  }

  const supabase = createServiceClient();

  if (!supabase) {
    return { ok: false, message: "Supabase service role is not configured" };
  }

  const encryptedKey = encryptSecret(parsed.data.api_key);

  let headers: Record<string, string> | null = null;

  if (parsed.data.headers_json) {
    try {
      headers = JSON.parse(parsed.data.headers_json) as Record<string, string>;
    } catch {
      return { ok: false, message: "Headers JSON is invalid" };
    }
  }

  const { error } = await supabase.from("api_configs").insert({
    name: parsed.data.name,
    base_url: parsed.data.base_url,
    api_key_encrypted: encryptedKey,
    headers,
    is_active: true,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  void logAuditEvent({
    action_type: "api_config_saved",
    entity_type: "api_configs",
    metadata: { name: parsed.data.name, base_url: parsed.data.base_url },
  }).catch(() => undefined);

  return { ok: true, message: "Saved" };
}

export async function testApiConfigAction(payload: { base_url: string; api_key?: string }) {
  await assertPermission("it:view");

  const result = await testApiConnection(payload.base_url, payload.api_key);

  void logAuditEvent({
    action_type: "api_connection_tested",
    entity_type: "api_configs",
    metadata: { base_url: payload.base_url, ok: result.ok, status: result.status },
  }).catch(() => undefined);

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  return { ok: true, message: result.message };
}

export async function forceOverridePermissionAction(payload: {
  user_id: string;
  role: "CEO" | "MANAGER" | "HEAD" | "STAFF" | "IT";
}) {
  await assertPermission("it:manage");

  const supabase = createServiceClient();

  if (!supabase) {
    return { ok: false, message: "Supabase service role is not configured" };
  }

  const { error } = await supabase
    .from("users")
    .update({ role: payload.role })
    .eq("id", payload.user_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  void logAuditEvent({
    action_type: "force_override_permissions",
    entity_type: "users",
    entity_id: payload.user_id,
    metadata: { role: payload.role },
  }).catch(() => undefined);

  return { ok: true, message: "Override applied" };
}
