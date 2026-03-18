import { headers } from "next/headers";

import { getAuthUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { AuditLogPayload } from "@/types";

export async function logAuditEvent(payload: AuditLogPayload) {
  const supabase = createClient();

  if (!supabase) {
    return;
  }

  const user = await getAuthUser();
  const requestHeaders = headers();
  const ip = requestHeaders.get("x-forwarded-for") ?? requestHeaders.get("x-real-ip");
  const userAgent = requestHeaders.get("user-agent");

  await supabase.from("audit_logs").insert({
    user_id: user?.id ?? null,
    action_type: payload.action_type,
    entity_type: payload.entity_type,
    entity_id: payload.entity_id ?? null,
    ip_address: ip,
    device_info: userAgent,
    metadata: payload.metadata ?? null,
  });
}
