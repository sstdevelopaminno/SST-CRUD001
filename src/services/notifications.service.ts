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

  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, read, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return notifications.slice(0, limit);
  }

  return data;
}