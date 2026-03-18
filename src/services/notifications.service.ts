import { createClient } from "@/lib/supabase/server";
import { notifications } from "@/services/mock-data";

export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export async function getNotifications(limit = 10): Promise<NotificationRow[]> {
  const supabase = createClient();

  if (!supabase) {
    return notifications.slice(0, limit);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return [];
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 20));

  if (error || !data) {
    return notifications.slice(0, limit);
  }

  return data;
}
