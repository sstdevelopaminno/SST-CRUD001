"use server";

import { logAuditEvent } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

export interface NotificationDto {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export async function getNotificationsAction(limit = 10): Promise<{ ok: boolean; items: NotificationDto[]; message?: string }> {
  const supabase = createClient();

  if (!supabase) {
    return { ok: false, items: [], message: "Supabase is not configured" };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, items: [], message: "Unauthorized" };
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 20));

  if (error || !data) {
    return { ok: false, items: [], message: error?.message ?? "Unable to load notifications" };
  }

  return { ok: true, items: data };
}

export async function markNotificationReadAction(notificationId: string) {
  const supabase = createClient();

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured" };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: "Unauthorized" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  void logAuditEvent({
    action_type: "notification_read",
    entity_type: "notifications",
    entity_id: notificationId,
  }).catch(() => undefined);

  return { ok: true };
}

export async function markAllNotificationsReadAction() {
  const supabase = createClient();

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured" };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: "Unauthorized" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) {
    return { ok: false, message: error.message };
  }

  void logAuditEvent({
    action_type: "notifications_mark_all_read",
    entity_type: "notifications",
    metadata: { user_id: user.id },
  }).catch(() => undefined);

  return { ok: true };
}
