import { resolveRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { users } from "@/services/mock-data";

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: "CEO" | "MANAGER" | "HEAD" | "STAFF" | "IT";
  department: string;
  active: boolean;
}

export async function getUsers(): Promise<AdminUserItem[]> {
  const supabase = createClient();

  if (!supabase) {
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: resolveRole(user.role),
      department: user.department,
      active: true,
    }));
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, role, department, active")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: resolveRole(user.role),
      department: user.department,
      active: true,
    }));
  }

  return data.map((item) => ({
    id: item.id,
    name: item.full_name,
    email: item.email,
    role: resolveRole(item.role),
    department: item.department ?? "-",
    active: item.active,
  }));
}
