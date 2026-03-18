import { createClient } from "@/lib/supabase/server";
import { users } from "@/services/mock-data";

export async function getUsers() {
  const supabase = createClient();

  if (!supabase) {
    return users;
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, role, department")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return users;
  }

  return data.map((item) => ({
    id: item.id,
    name: item.full_name,
    email: item.email,
    role: item.role,
    department: item.department ?? "-",
  }));
}
