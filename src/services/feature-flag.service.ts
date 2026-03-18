import { createClient } from "@/lib/supabase/server";
import { defaultFeatureFlags } from "@/services/mock-data";

export async function getFeatureFlags() {
  const supabase = createClient();

  if (!supabase) {
    return defaultFeatureFlags;
  }

  const { data, error } = await supabase.from("feature_flags").select("id, key, module, enabled, description").order("module");

  if (error || !data || data.length === 0) {
    return defaultFeatureFlags;
  }

  return data;
}

export async function getEnabledModuleMap() {
  const flags = await getFeatureFlags();

  return flags.reduce<Record<string, boolean>>((acc, item) => {
    acc[item.key] = item.enabled;
    return acc;
  }, {});
}
