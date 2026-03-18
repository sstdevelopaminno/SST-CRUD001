import { createClient } from "@/lib/supabase/server";
import { defaultFeatureFlags } from "@/services/mock-data";

const FEATURE_FLAG_CACHE_TTL_MS = 30_000;
let featureFlagCache: { expiresAt: number; value: Awaited<ReturnType<typeof getFeatureFlagsFromDb>> } | null = null;

async function getFeatureFlagsFromDb() {
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

export async function getFeatureFlags() {
  const now = Date.now();

  if (featureFlagCache && featureFlagCache.expiresAt > now) {
    return featureFlagCache.value;
  }

  const value = await getFeatureFlagsFromDb();
  featureFlagCache = {
    value,
    expiresAt: now + FEATURE_FLAG_CACHE_TTL_MS,
  };

  return value;
}

export async function getEnabledModuleMap() {
  const flags = await getFeatureFlags();

  return flags.reduce<Record<string, boolean>>((acc, item) => {
    acc[item.key] = item.enabled;
    return acc;
  }, {});
}
