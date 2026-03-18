import { hasPermission } from "@/lib/rbac";
import { getUserProfile } from "@/lib/auth/server";
import type { PermissionKey } from "@/types";

export async function assertPermission(permission: PermissionKey) {
  const user = await getUserProfile();

  if (!user) {
    throw new Error("Unauthorized");
  }

  if (!hasPermission(user.role, permission)) {
    throw new Error("Forbidden");
  }

  return user;
}
