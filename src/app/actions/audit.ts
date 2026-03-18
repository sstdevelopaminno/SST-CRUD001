"use server";

import { logAuditEvent } from "@/lib/audit";
import { auditSchema } from "@/lib/validators";

export async function logAuditEventAction(payload: unknown) {
  const parsed = auditSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: "Invalid audit payload" };
  }

  await logAuditEvent(parsed.data);

  return { ok: true };
}
