import { createBrowserClient } from "@supabase/ssr";

import { env, isSupabaseConfigured } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!isSupabaseConfigured) {
    return null;
  }

  if (!client) {
    client = createBrowserClient(env.supabaseUrl!, env.supabaseAnonKey!);
  }

  return client;
}
