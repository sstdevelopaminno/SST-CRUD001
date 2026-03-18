import { createClient } from "@/lib/supabase/server";
import { customers } from "@/services/mock-data";

const DEFAULT_LIMIT = 100;

export async function getCustomers(limit = DEFAULT_LIMIT) {
  const supabase = createClient();

  if (!supabase) {
    return customers.slice(0, limit);
  }

  const safeLimit = Math.min(Math.max(limit, 1), 200);

  const { data, error } = await supabase
    .from("customers")
    .select("id, name, email, phone, status")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error || !data) {
    return customers.slice(0, safeLimit);
  }

  return data;
}
