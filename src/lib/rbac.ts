import { DEFAULT_ROLE_PERMISSIONS, ROUTE_PERMISSION } from "@/lib/constants/routes";
import type { PermissionKey, SystemRole } from "@/types";

export function resolveRole(role?: string | null): SystemRole {
  if (!role) {
    return "STAFF";
  }

  const normalized = role.toUpperCase();

  if (normalized === "CEO" || normalized === "MANAGER" || normalized === "HEAD" || normalized === "STAFF" || normalized === "IT") {
    return normalized;
  }

  return "STAFF";
}

export function hasPermission(role: SystemRole, permission: PermissionKey) {
  if (role === "CEO") {
    return true;
  }

  return DEFAULT_ROLE_PERMISSIONS[role].includes(permission);
}

export function canAccessPath(role: SystemRole, path: string) {
  const matched = Object.keys(ROUTE_PERMISSION).find((route) => path === route || path.startsWith(`${route}/`));

  if (!matched) {
    return true;
  }

  return hasPermission(role, ROUTE_PERMISSION[matched]);
}
