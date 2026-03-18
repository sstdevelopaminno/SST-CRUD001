import { redirect } from "next/navigation";

import { resolveRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/types";

export async function getSession() {
  const supabase = createClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const session = await getSession();

  if (!session?.user) {
    return null;
  }

  const supabase = createClient();

  if (!supabase) {
    return {
      id: session.user.id,
      email: session.user.email ?? "",
      full_name: (session.user.user_metadata.full_name as string | undefined) ?? "SST User",
      role: resolveRole(session.user.user_metadata.role as string | undefined),
      department: (session.user.user_metadata.department as string | undefined) ?? null,
      active: true,
    };
  }

  const { data } = await supabase
    .from("users")
    .select("id, email, full_name, role, department, active")
    .eq("id", session.user.id)
    .single();

  if (!data) {
    return {
      id: session.user.id,
      email: session.user.email ?? "",
      full_name: (session.user.user_metadata.full_name as string | undefined) ?? "SST User",
      role: resolveRole(session.user.user_metadata.role as string | undefined),
      department: (session.user.user_metadata.department as string | undefined) ?? null,
      active: true,
    };
  }

  return {
    ...data,
    role: resolveRole(data.role),
  };
}

export async function requireUser(locale: string) {
  const profile = await getUserProfile();

  if (!profile) {
    redirect(`/${locale}/login`);
  }

  return profile;
}
