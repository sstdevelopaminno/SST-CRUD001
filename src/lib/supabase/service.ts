import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

export function createServiceClient() {
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    return null;
  }

  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
