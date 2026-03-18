import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  locale: z.string().default("en"),
});

export const featureFlagSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean(),
});

export const apiConfigSchema = z.object({
  name: z.string().min(2),
  base_url: z.string().url(),
  api_key: z.string().min(8),
  headers_json: z.string().optional(),
});

export const auditSchema = z.object({
  action_type: z.string().min(2),
  entity_type: z.string().min(2),
  entity_id: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});
