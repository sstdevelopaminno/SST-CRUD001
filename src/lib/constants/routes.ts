import type { FeatureFlagKey, PermissionKey, SystemRole } from "@/types";

export const PROTECTED_MODULES = [
  "dashboard",
  "crm",
  "projects",
  "jobs",
  "billing",
  "documents",
  "approvals",
  "admin",
  "it-panel",
] as const;

export type ProtectedModule = (typeof PROTECTED_MODULES)[number];

export interface NavItem {
  key: ProtectedModule;
  href: string;
  permission: PermissionKey;
  featureFlag: FeatureFlagKey;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", permission: "dashboard:view", featureFlag: "dashboard" },
  { key: "crm", href: "/crm", permission: "crm:view", featureFlag: "crm" },
  { key: "projects", href: "/projects", permission: "projects:view", featureFlag: "projects" },
  { key: "jobs", href: "/jobs", permission: "jobs:view", featureFlag: "jobs" },
  { key: "billing", href: "/billing", permission: "billing:view", featureFlag: "billing" },
  { key: "documents", href: "/documents", permission: "documents:view", featureFlag: "documents" },
  { key: "approvals", href: "/approvals", permission: "approvals:view", featureFlag: "approvals" },
  { key: "admin", href: "/admin", permission: "admin:view", featureFlag: "admin" },
  { key: "it-panel", href: "/it-panel", permission: "it:view", featureFlag: "it-panel" },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRole, PermissionKey[]> = {
  CEO: [
    "dashboard:view",
    "crm:view",
    "crm:edit",
    "projects:view",
    "projects:edit",
    "jobs:view",
    "jobs:edit",
    "billing:view",
    "billing:edit",
    "documents:view",
    "documents:sign",
    "approvals:view",
    "approvals:approve",
    "admin:view",
    "admin:manage",
    "it:view",
    "it:manage",
  ],
  MANAGER: [
    "dashboard:view",
    "crm:view",
    "crm:edit",
    "projects:view",
    "projects:edit",
    "jobs:view",
    "jobs:edit",
    "billing:view",
    "documents:view",
    "documents:sign",
    "approvals:view",
    "approvals:approve",
  ],
  HEAD: [
    "dashboard:view",
    "crm:view",
    "projects:view",
    "projects:edit",
    "jobs:view",
    "jobs:edit",
    "documents:view",
    "documents:sign",
    "approvals:view",
  ],
  STAFF: ["dashboard:view", "crm:view", "crm:edit", "projects:view", "jobs:view", "jobs:edit", "documents:view"],
  IT: ["dashboard:view", "it:view", "it:manage", "admin:view", "admin:manage", "approvals:view"],
};

export const ROUTE_PERMISSION: Record<string, PermissionKey> = {
  "/dashboard": "dashboard:view",
  "/crm": "crm:view",
  "/projects": "projects:view",
  "/jobs": "jobs:view",
  "/billing": "billing:view",
  "/documents": "documents:view",
  "/approvals": "approvals:view",
  "/admin": "admin:view",
  "/it-panel": "it:view",
};
