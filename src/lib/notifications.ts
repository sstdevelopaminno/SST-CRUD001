import { createServiceClient } from "@/lib/supabase/service";

export async function createInAppNotification(userId: string, title: string, body: string) {
  const serviceClient = createServiceClient();

  if (!serviceClient) {
    return;
  }

  await serviceClient.from("notifications").insert({
    user_id: userId,
    title,
    body,
    read: false,
  });
}
