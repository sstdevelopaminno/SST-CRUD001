import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { apiConfigs } from "@/services/mock-data";

export async function getApiConfigs() {
  const supabase = createClient();

  if (!supabase) {
    return apiConfigs;
  }

  const { data, error } = await supabase.from("api_configs").select("id, name, base_url, is_active, headers").order("created_at", { ascending: false });

  if (error || !data) {
    return apiConfigs;
  }

  return data;
}

export async function testApiConnection(baseUrl: string, apiKey?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(baseUrl, {
      method: "GET",
      headers: {
        Authorization: apiKey ? `Bearer ${apiKey}` : "",
        "X-App-Source": "sst-backoffice",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    return {
      ok: response.ok,
      status: response.status,
      message: response.ok ? "Connection successful" : `Remote API responded with ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : "Unknown connection error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function maskSecret(secret: string) {
  if (!secret) {
    return "";
  }

  if (secret.length <= 8) {
    return "********";
  }

  return `${secret.slice(0, 4)}${"*".repeat(Math.max(secret.length - 8, 4))}${secret.slice(-4)}`;
}

export function getEncryptionSalt() {
  return env.appUrl ?? "sst-local";
}
