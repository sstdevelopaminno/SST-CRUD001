export const SYSTEM_ROLES = ["CEO", "MANAGER", "HEAD", "STAFF", "IT"] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

export type PermissionKey =
  | "dashboard:view"
  | "crm:view"
  | "crm:edit"
  | "projects:view"
  | "projects:edit"
  | "sales:view"
  | "sales:manage"
  | "jobs:view"
  | "jobs:edit"
  | "billing:view"
  | "billing:edit"
  | "documents:view"
  | "documents:sign"
  | "approvals:view"
  | "approvals:approve"
  | "admin:view"
  | "admin:manage"
  | "it:view"
  | "it:manage";

export type FeatureFlagKey =
  | "dashboard"
  | "crm"
  | "projects"
  | "sales-team"
  | "jobs"
  | "billing"
  | "documents"
  | "approvals"
  | "admin"
  | "it-panel";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: SystemRole;
  department: string | null;
  active: boolean;
}

export interface AuditLogPayload {
  action_type: string;
  entity_type: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
}
