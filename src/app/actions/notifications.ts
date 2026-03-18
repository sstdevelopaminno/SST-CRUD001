"use server";

import { logAuditEvent } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationReadAction(notificationId: string) {
  const supabase = createClient();

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured" };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return { ok: false, message: "Unauthorized" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", session.user.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  await logAuditEvent({
    action_type: "notification_read",
    entity_type: "notifications",
    entity_id: notificationId,
  });

  return { ok: true };
}

export async function markAllNotificationsReadAction() {
  const supabase = createClient();

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured" };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return { ok: false, message: "Unauthorized" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", session.user.id)
    .eq("read", false);

  if (error) {
    return { ok: false, message: error.message };
  }

  await logAuditEvent({
    action_type: "notifications_mark_all_read",
    entity_type: "notifications",
    metadata: { user_id: session.user.id },
  });

  return { ok: true };
}
