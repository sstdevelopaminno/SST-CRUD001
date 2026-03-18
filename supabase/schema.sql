-- SST Backoffice schema
-- Run in Supabase SQL editor

create extension if not exists "pgcrypto";

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_code text not null references public.roles(code) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  unique (role_code, permission_key)
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default 'SST User',
  role text not null default 'STAFF' check (role in ('CEO', 'MANAGER', 'HEAD', 'STAFF', 'IT')),
  department text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  status text not null default 'prospect',
  owner_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'todo',
  owner_id uuid references public.users(id) on delete set null,
  progress numeric(5,2) not null default 0,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  assignee_id uuid references public.users(id) on delete set null,
  status text not null default 'todo',
  priority text not null default 'medium',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  invoice_no text not null unique,
  amount numeric(12,2) not null default 0,
  status text not null default 'pending',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_no text not null unique,
  vendor_name text not null,
  amount numeric(12,2) not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_path text not null,
  file_type text not null,
  file_size bigint not null,
  uploaded_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.signatures (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  signer_id uuid not null references public.users(id) on delete cascade,
  signature_data_url text not null,
  signed_at timestamptz not null default now(),
  ip_address text,
  device_info text,
  metadata jsonb,
  unique (document_id, signer_id)
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  requester_id uuid not null references public.users(id) on delete cascade,
  approver_id uuid references public.users(id) on delete set null,
  level int not null default 1,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  note text,
  signature_id uuid references public.signatures(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  enabled boolean not null default true,
  module text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.api_configs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_url text not null,
  api_key_encrypted text not null,
  headers jsonb,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  action_type text not null,
  entity_type text not null,
  entity_id text,
  timestamp timestamptz not null default now(),
  ip_address text,
  device_info text,
  location text,
  metadata jsonb
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.get_my_role()
returns text
language sql
stable
as $$
  select coalesce((select role from public.users where id = auth.uid()), 'STAFF');
$$;

create or replace function public.is_ceo_or_it()
returns boolean
language sql
stable
as $$
  select public.get_my_role() in ('CEO', 'IT');
$$;

create trigger trg_users_updated_at before update on public.users
for each row execute function public.set_updated_at();

create trigger trg_customers_updated_at before update on public.customers
for each row execute function public.set_updated_at();

create trigger trg_projects_updated_at before update on public.projects
for each row execute function public.set_updated_at();

create trigger trg_jobs_updated_at before update on public.jobs
for each row execute function public.set_updated_at();

create trigger trg_invoices_updated_at before update on public.invoices
for each row execute function public.set_updated_at();

create trigger trg_purchase_orders_updated_at before update on public.purchase_orders
for each row execute function public.set_updated_at();

create trigger trg_feature_flags_updated_at before update on public.feature_flags
for each row execute function public.set_updated_at();

create trigger trg_api_configs_updated_at before update on public.api_configs
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.customers enable row level security;
alter table public.projects enable row level security;
alter table public.jobs enable row level security;
alter table public.invoices enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.documents enable row level security;
alter table public.signatures enable row level security;
alter table public.approvals enable row level security;
alter table public.feature_flags enable row level security;
alter table public.api_configs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

create policy "users_read_self_or_admin" on public.users
for select using (auth.uid() = id or public.is_ceo_or_it());

create policy "users_manage_admin" on public.users
for all using (public.is_ceo_or_it()) with check (public.is_ceo_or_it());

create policy "roles_read_authenticated" on public.roles
for select using (auth.role() = 'authenticated');

create policy "permissions_read_authenticated" on public.permissions
for select using (auth.role() = 'authenticated');

create policy "role_permissions_read_authenticated" on public.role_permissions
for select using (auth.role() = 'authenticated');

create policy "core_data_select_authenticated" on public.customers
for select using (auth.role() = 'authenticated');

create policy "core_data_write_staff_plus" on public.customers
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "projects_select_authenticated" on public.projects
for select using (auth.role() = 'authenticated');

create policy "projects_write_staff_plus" on public.projects
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "jobs_select_authenticated" on public.jobs
for select using (auth.role() = 'authenticated');

create policy "jobs_write_staff_plus" on public.jobs
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "invoices_select_authenticated" on public.invoices
for select using (auth.role() = 'authenticated');

create policy "invoices_write_manager_plus" on public.invoices
for all using (public.get_my_role() in ('CEO', 'MANAGER', 'HEAD', 'IT'))
with check (public.get_my_role() in ('CEO', 'MANAGER', 'HEAD', 'IT'));

create policy "po_select_authenticated" on public.purchase_orders
for select using (auth.role() = 'authenticated');

create policy "po_write_manager_plus" on public.purchase_orders
for all using (public.get_my_role() in ('CEO', 'MANAGER', 'HEAD', 'IT'))
with check (public.get_my_role() in ('CEO', 'MANAGER', 'HEAD', 'IT'));

create policy "documents_select_authenticated" on public.documents
for select using (auth.role() = 'authenticated');

create policy "documents_upload_authenticated" on public.documents
for insert with check (auth.uid() = uploaded_by);

create policy "documents_manage_admin" on public.documents
for update using (public.is_ceo_or_it()) with check (public.is_ceo_or_it());

create policy "signatures_select_authenticated" on public.signatures
for select using (auth.role() = 'authenticated');

create policy "signatures_insert_self" on public.signatures
for insert with check (auth.uid() = signer_id);

create policy "approvals_select_authenticated" on public.approvals
for select using (auth.role() = 'authenticated');

create policy "approvals_insert_authenticated" on public.approvals
for insert with check (auth.role() = 'authenticated');

create policy "approvals_update_manager_plus" on public.approvals
for update using (public.get_my_role() in ('CEO', 'MANAGER', 'HEAD', 'IT'))
with check (public.get_my_role() in ('CEO', 'MANAGER', 'HEAD', 'IT'));

create policy "feature_flags_read_authenticated" on public.feature_flags
for select using (auth.role() = 'authenticated');

create policy "feature_flags_manage_it" on public.feature_flags
for all using (public.get_my_role() in ('CEO', 'IT'))
with check (public.get_my_role() in ('CEO', 'IT'));

create policy "api_configs_read_it" on public.api_configs
for select using (public.get_my_role() in ('CEO', 'IT'));

create policy "api_configs_manage_it" on public.api_configs
for all using (public.get_my_role() in ('CEO', 'IT'))
with check (public.get_my_role() in ('CEO', 'IT'));

create policy "audit_read_admin" on public.audit_logs
for select using (public.get_my_role() in ('CEO', 'IT'));

create policy "audit_insert_authenticated" on public.audit_logs
for insert with check (auth.role() = 'authenticated');

create policy "notifications_select_own" on public.notifications
for select using (auth.uid() = user_id);

create policy "notifications_update_own" on public.notifications
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.roles (code, name, description)
values
  ('CEO', 'Chief Executive Officer', 'Full access role'),
  ('MANAGER', 'Manager', 'Delegated approval role'),
  ('HEAD', 'Head', 'Department control role'),
  ('STAFF', 'Staff', 'Data entry role'),
  ('IT', 'IT Administrator', 'System-level control role')
on conflict (code) do nothing;

insert into public.permissions (key, description)
values
  ('dashboard:view', 'View dashboard'),
  ('crm:view', 'View customer data'),
  ('crm:edit', 'Manage customer data'),
  ('projects:view', 'View projects'),
  ('projects:edit', 'Manage projects'),
  ('jobs:view', 'View jobs'),
  ('jobs:edit', 'Manage jobs'),
  ('billing:view', 'View billing data'),
  ('billing:edit', 'Manage billing data'),
  ('documents:view', 'View documents'),
  ('documents:sign', 'Sign documents'),
  ('approvals:view', 'View approvals'),
  ('approvals:approve', 'Approve workflow steps'),
  ('admin:view', 'View admin panel'),
  ('admin:manage', 'Manage users and roles'),
  ('it:view', 'View IT panel'),
  ('it:manage', 'Manage IT controls')
on conflict (key) do nothing;

insert into public.role_permissions (role_code, permission_key)
values
  ('CEO', 'dashboard:view'),
  ('CEO', 'crm:view'),
  ('CEO', 'crm:edit'),
  ('CEO', 'projects:view'),
  ('CEO', 'projects:edit'),
  ('CEO', 'jobs:view'),
  ('CEO', 'jobs:edit'),
  ('CEO', 'billing:view'),
  ('CEO', 'billing:edit'),
  ('CEO', 'documents:view'),
  ('CEO', 'documents:sign'),
  ('CEO', 'approvals:view'),
  ('CEO', 'approvals:approve'),
  ('CEO', 'admin:view'),
  ('CEO', 'admin:manage'),
  ('CEO', 'it:view'),
  ('CEO', 'it:manage'),
  ('MANAGER', 'dashboard:view'),
  ('MANAGER', 'crm:view'),
  ('MANAGER', 'crm:edit'),
  ('MANAGER', 'projects:view'),
  ('MANAGER', 'projects:edit'),
  ('MANAGER', 'jobs:view'),
  ('MANAGER', 'jobs:edit'),
  ('MANAGER', 'billing:view'),
  ('MANAGER', 'documents:view'),
  ('MANAGER', 'documents:sign'),
  ('MANAGER', 'approvals:view'),
  ('MANAGER', 'approvals:approve'),
  ('HEAD', 'dashboard:view'),
  ('HEAD', 'crm:view'),
  ('HEAD', 'projects:view'),
  ('HEAD', 'projects:edit'),
  ('HEAD', 'jobs:view'),
  ('HEAD', 'jobs:edit'),
  ('HEAD', 'documents:view'),
  ('HEAD', 'documents:sign'),
  ('HEAD', 'approvals:view'),
  ('STAFF', 'dashboard:view'),
  ('STAFF', 'crm:view'),
  ('STAFF', 'crm:edit'),
  ('STAFF', 'projects:view'),
  ('STAFF', 'jobs:view'),
  ('STAFF', 'jobs:edit'),
  ('STAFF', 'documents:view'),
  ('IT', 'dashboard:view'),
  ('IT', 'it:view'),
  ('IT', 'it:manage'),
  ('IT', 'admin:view'),
  ('IT', 'admin:manage'),
  ('IT', 'approvals:view')
on conflict (role_code, permission_key) do nothing;

insert into public.feature_flags (key, module, enabled, description)
values
  ('dashboard', 'dashboard', true, 'Dashboard module'),
  ('crm', 'crm', true, 'CRM module'),
  ('projects', 'projects', true, 'Projects module'),
  ('jobs', 'jobs', true, 'Jobs module'),
  ('billing', 'billing', true, 'Billing module'),
  ('documents', 'documents', true, 'Documents module'),
  ('approvals', 'approvals', true, 'Approvals module'),
  ('admin', 'admin', true, 'Admin module'),
  ('it-panel', 'it-panel', true, 'IT panel module')
on conflict (key) do nothing;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_bucket_read" on storage.objects
for select using (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "documents_bucket_insert" on storage.objects
for insert with check (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "documents_bucket_update" on storage.objects
for update using (bucket_id = 'documents' and auth.role() = 'authenticated')
with check (bucket_id = 'documents' and auth.role() = 'authenticated');

create index if not exists idx_customers_owner_id on public.customers(owner_id);
create index if not exists idx_projects_customer_id on public.projects(customer_id);
create index if not exists idx_projects_owner_id on public.projects(owner_id);
create index if not exists idx_projects_status on public.projects(status);
create index if not exists idx_jobs_project_id on public.jobs(project_id);
create index if not exists idx_jobs_assignee_id on public.jobs(assignee_id);
create index if not exists idx_jobs_status on public.jobs(status);
create index if not exists idx_invoices_customer_id on public.invoices(customer_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_purchase_orders_status on public.purchase_orders(status);
create index if not exists idx_documents_uploaded_by on public.documents(uploaded_by);
create index if not exists idx_documents_created_at on public.documents(created_at desc);
create index if not exists idx_signatures_document_id on public.signatures(document_id);
create index if not exists idx_approvals_status on public.approvals(status);
create index if not exists idx_approvals_approver_id on public.approvals(approver_id);
create index if not exists idx_approvals_requester_id on public.approvals(requester_id);
create index if not exists idx_approvals_created_at on public.approvals(created_at desc);
create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);
create index if not exists idx_audit_logs_timestamp on public.audit_logs(timestamp desc);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_user_read on public.notifications(user_id, read);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);

create or replace function public.schema_healthcheck()
returns table (
  table_name text,
  table_exists boolean,
  rls_enabled boolean,
  policy_count bigint
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.role() <> 'service_role' and public.get_my_role() not in ('CEO', 'IT') then
    raise exception 'not authorized';
  end if;

  return query
  with required_tables(name) as (
    values
      ('users'),
      ('roles'),
      ('permissions'),
      ('role_permissions'),
      ('customers'),
      ('projects'),
      ('jobs'),
      ('invoices'),
      ('purchase_orders'),
      ('approvals'),
      ('documents'),
      ('signatures'),
      ('audit_logs'),
      ('api_configs'),
      ('feature_flags'),
      ('notifications')
  )
  select
    t.name,
    c.oid is not null as table_exists,
    coalesce(c.relrowsecurity, false) as rls_enabled,
    coalesce((
      select count(*)
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = t.name
    ), 0) as policy_count
  from required_tables t
  left join pg_class c
    on c.relname = t.name
   and c.relkind = 'r'
   and c.relnamespace = 'public'::regnamespace;
end;
$$;
