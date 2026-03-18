#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("[verify:supabase] Missing .env.local");
  process.exit(1);
}

const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const index = line.indexOf("=");
  env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("[verify:supabase] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const requiredTables = [
  "users",
  "roles",
  "permissions",
  "role_permissions",
  "customers",
  "projects",
  "jobs",
  "invoices",
  "purchase_orders",
  "approvals",
  "documents",
  "signatures",
  "audit_logs",
  "api_configs",
  "feature_flags",
  "notifications",
];

function headers() {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
}

async function checkTables() {
  const results = [];
  for (const table of requiredTables) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
      method: "GET",
      headers: headers(),
    });
    results.push({ table, status: response.status });
  }
  return results;
}

async function checkRlsViaRpc() {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/schema_healthcheck`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    return { ok: false, status: response.status, rows: [] };
  }

  const rows = await response.json();
  return { ok: true, status: response.status, rows };
}

(async () => {
  console.log("[verify:supabase] Checking required tables...");
  const tableResults = await checkTables();
  tableResults.forEach((item) => {
    const status = item.status === 200 ? "OK" : "MISSING_OR_BLOCKED";
    console.log(`- ${item.table}: ${item.status} ${status}`);
  });

  const missingTables = tableResults.filter((item) => item.status === 404).map((item) => item.table);

  console.log("\n[verify:supabase] Checking RLS health RPC (schema_healthcheck)...");
  const rlsResult = await checkRlsViaRpc();

  if (!rlsResult.ok) {
    console.log(`- RPC unavailable (${rlsResult.status}). Run latest supabase/schema.sql first.`);
  } else {
    let rlsError = false;
    for (const row of rlsResult.rows) {
      const pass = row.table_exists && row.rls_enabled && row.policy_count > 0;
      if (!pass) {
        rlsError = true;
      }
      console.log(
        `- ${row.table_name}: exists=${row.table_exists} rls=${row.rls_enabled} policies=${row.policy_count} ${pass ? "OK" : "FAIL"}`,
      );
    }

    if (rlsError) {
      console.error("\n[verify:supabase] RLS verification failed");
      process.exit(1);
    }
  }

  if (missingTables.length > 0) {
    console.error(`\n[verify:supabase] Missing tables: ${missingTables.join(", ")}`);
    process.exit(1);
  }

  console.log("\n[verify:supabase] Schema verification passed");
})();
