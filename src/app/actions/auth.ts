"use server";

import { redirect } from "next/navigation";

import { logAuditEvent } from "@/lib/audit";
import { getMissingSupabaseEnvKeys } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validators";

export interface LoginActionState {
  error: string | null;
  success: boolean;
  redirectTo: string | null;
}

export async function loginAction(_: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    locale: formData.get("locale"),
  });

  if (!parsed.success) {
    return { error: "Invalid credentials format", success: false, redirectTo: null };
  }

  const supabase = createClient();

  if (!supabase) {
    const missing = getMissingSupabaseEnvKeys();
    return {
      error: `Supabase is not configured. Missing: ${missing.join(", ")}`,
      success: false,
      redirectTo: null,
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.session) {
    await logAuditEvent({
      action_type: "login_failed",
      entity_type: "auth",
      metadata: { email: parsed.data.email },
    });

    return { error: error?.message ?? "Login failed", success: false, redirectTo: null };
  }

  await logAuditEvent({
    action_type: "login_success",
    entity_type: "auth",
    metadata: { user_id: data.user.id },
  });

  return {
    error: null,
    success: true,
    redirectTo: `/${parsed.data.locale}/dashboard`,
  };
}

export async function logoutAction(formData: FormData) {
  const locale = (formData.get("locale") as string | null) ?? "en";
  const supabase = createClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  await logAuditEvent({
    action_type: "logout",
    entity_type: "auth",
  });

  redirect(`/${locale}/login`);
}
