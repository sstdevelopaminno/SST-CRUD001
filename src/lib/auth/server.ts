import { cache } from "react";
import { redirect } from "next/navigation";

import { resolveRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/types";

export const getAuthUser = cache(async () => {
  const supabase = createClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
});

export async function getUserProfile(): Promise<UserProfile | null> {
  const user = await getAuthUser();

  if (!user) {
    return null;
  }

  const supabase = createClient();

  if (!supabase) {
    return {
      id: user.id,
      email: user.email ?? "",
      full_name: (user.user_metadata.full_name as string | undefined) ?? "SST User",
      role: resolveRole(user.user_metadata.role as string | undefined),
      department: (user.user_metadata.department as string | undefined) ?? null,
      active: true,
    };
  }

  const { data } = await supabase
    .from("users")
    .select("id, email, full_name, role, department, active")
    .eq("id", user.id)
    .single();

  if (!data) {
    return {
      id: user.id,
      email: user.email ?? "",
      full_name: (user.user_metadata.full_name as string | undefined) ?? "SST User",
      role: resolveRole(user.user_metadata.role as string | undefined),
      department: (user.user_metadata.department as string | undefined) ?? null,
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
