import { createClient } from "@/lib/supabase/server";
import { customers } from "@/services/mock-data";

export async function getCustomers() {
  const supabase = createClient();

  if (!supabase) {
    return customers;
  }

  const { data, error } = await supabase.from("customers").select("id, name, email, phone, status").order("created_at", { ascending: false });

  if (error || !data) {
    return customers;
  }

  return data;
}
