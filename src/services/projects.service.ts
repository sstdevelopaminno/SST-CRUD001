import { createClient } from "@/lib/supabase/server";
import { projectBoard } from "@/services/mock-data";

const DEFAULT_LIMIT = 80;

interface ProjectBoardRow {
  id: string;
  name: string;
  status: string;
  due_date: string | null;
  owner_id: string | null;
}

interface ProjectCaseRow {
  id: string;
  project_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  sales_owner_id: string;
  commission_owner_id: string;
  commission_rate: number;
  approval_status: string;
  lifecycle_status: string;
  opened_at: string;
  created_at: string;
}

interface ProjectTransferRow {
  id: string;
  project_case_id: string;
  from_sales_id: string;
  to_sales_id: string;
  reason: string | null;
  status: string;
  requested_by: string;
  approver_id: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface ProjectRequirementFlags {
  fullName: boolean;
  phone: boolean;
  address: boolean;
  facePhoto: boolean;
  idCard: boolean;
  idAddress: boolean;
}

export interface ProjectTemplateItem {
  id: string;
  name: string;
  description: string;
  status: string;
  ownerId: string | null;
  ownerName: string;
  customerId: string | null;
  customerName: string;
  dueDate: string | null;
  commissionRate: number;
  active: boolean;
  isTemplate: boolean;
  requirements: ProjectRequirementFlags;
  updatedAt: string;
  createdAt: string;
}

export type ProjectCommissionSetting = ProjectTemplateItem;

export interface ProjectOption {
  id: string;
  name: string;
}

export interface ProjectCaseItem {
  id: string;
  projectId: string;
  projectName: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  ownerId: string;
  ownerName: string;
  commissionOwnerId: string;
  commissionOwnerName: string;
  commissionRate: number;
  approvalStatus: string;
  lifecycleStatus: string;
  openedAt: string;
  createdAt: string;
}

export interface ProjectTransferItem {
  id: string;
  projectCaseId: string;
  projectName: string;
  fromSalesId: string;
  fromSalesName: string;
  toSalesId: string;
  toSalesName: string;
  reason: string;
  status: string;
  requestedBy: string;
  requestedByName: string;
  approverId: string | null;
  approverName: string;
  approvedAt: string | null;
  createdAt: string;
}

export interface ProjectManagementData {
  projects: ProjectTemplateItem[];
  customers: ProjectOption[];
  owners: ProjectOption[];
  cases: ProjectCaseItem[];
  pendingTransfers: ProjectTransferItem[];
}

export interface SalesProjectWorkspaceData {
  templates: ProjectTemplateItem[];
  myCases: ProjectCaseItem[];
  myTransfers: ProjectTransferItem[];
  transferTargets: ProjectOption[];
}

function normalizeRate(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(100, Math.max(0, parsed));
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function buildOwnerMap(rows: Array<{ id: string; full_name: string }> | null | undefined) {
  return new Map((rows ?? []).map((item) => [item.id, item.full_name]));
}

function mapRequirements(row: Record<string, unknown>): ProjectRequirementFlags {
  return {
    fullName: toBoolean(row.require_customer_name, true),
    phone: toBoolean(row.require_customer_phone, true),
    address: toBoolean(row.require_customer_address, false),
    facePhoto: toBoolean(row.require_face_photo, false),
    idCard: toBoolean(row.require_id_card, false),
    idAddress: toBoolean(row.require_id_address, false),
  };
}

function mapTemplateRow(
  row: Record<string, unknown>,
  ownerMap: Map<string, string>,
  customerMap: Map<string, string>,
): ProjectTemplateItem {
  const ownerId = typeof row.owner_id === "string" ? row.owner_id : null;
  const customerId = typeof row.customer_id === "string" ? row.customer_id : null;

  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "Untitled project"),
    description: String(row.description ?? ""),
    status: String(row.status ?? "todo"),
    ownerId,
    ownerName: ownerId ? ownerMap.get(ownerId) ?? ownerId : "Unassigned",
    customerId,
    customerName: customerId ? customerMap.get(customerId) ?? customerId : "-",
    dueDate: typeof row.due_date === "string" ? row.due_date : null,
    commissionRate: normalizeRate(row.commission_rate),
    active: toBoolean(row.active, true),
    isTemplate: toBoolean(row.is_template, true),
    requirements: mapRequirements(row),
    updatedAt: String(row.updated_at ?? row.created_at ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

function mapProjectCases(
  rows: ProjectCaseRow[] | null | undefined,
  templateMap: Map<string, ProjectTemplateItem>,
  userMap: Map<string, string>,
): ProjectCaseItem[] {
  if (!rows) {
    return [];
  }

  return rows.map((row) => {
    const template = templateMap.get(row.project_id);

    return {
      id: row.id,
      projectId: row.project_id,
      projectName: template?.name ?? row.project_id,
      customerName: row.customer_name ?? "-",
      customerPhone: row.customer_phone ?? "-",
      customerAddress: row.customer_address ?? "-",
      ownerId: row.sales_owner_id,
      ownerName: userMap.get(row.sales_owner_id) ?? row.sales_owner_id,
      commissionOwnerId: row.commission_owner_id,
      commissionOwnerName: userMap.get(row.commission_owner_id) ?? row.commission_owner_id,
      commissionRate: normalizeRate(row.commission_rate),
      approvalStatus: row.approval_status,
      lifecycleStatus: row.lifecycle_status,
      openedAt: row.opened_at,
      createdAt: row.created_at,
    };
  });
}

function mapTransfers(
  rows: ProjectTransferRow[] | null | undefined,
  caseMap: Map<string, ProjectCaseItem>,
  userMap: Map<string, string>,
): ProjectTransferItem[] {
  if (!rows) {
    return [];
  }

  return rows.map((row) => ({
    id: row.id,
    projectCaseId: row.project_case_id,
    projectName: caseMap.get(row.project_case_id)?.projectName ?? row.project_case_id,
    fromSalesId: row.from_sales_id,
    fromSalesName: userMap.get(row.from_sales_id) ?? row.from_sales_id,
    toSalesId: row.to_sales_id,
    toSalesName: userMap.get(row.to_sales_id) ?? row.to_sales_id,
    reason: row.reason ?? "",
    status: row.status,
    requestedBy: row.requested_by,
    requestedByName: userMap.get(row.requested_by) ?? row.requested_by,
    approverId: row.approver_id,
    approverName: row.approver_id ? userMap.get(row.approver_id) ?? row.approver_id : "-",
    approvedAt: row.approved_at,
    createdAt: row.created_at,
  }));
}

export async function getProjectBoard(limit = DEFAULT_LIMIT) {
  const supabase = createClient();

  if (!supabase) {
    return projectBoard;
  }

  const safeLimit = Math.min(Math.max(limit, 1), 180);

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, status, due_date, owner_id")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error || !data) {
    return projectBoard;
  }

  const ownerIds = Array.from(new Set(data.map((item) => item.owner_id).filter((id): id is string => typeof id === "string")));

  const ownerResult = ownerIds.length > 0 ? await supabase.from("users").select("id, full_name").in("id", ownerIds) : { data: [] as Array<{ id: string; full_name: string }>, error: null };

  const ownerMap = buildOwnerMap(ownerResult.data);

  const grouped = {
    todo: [] as { id: string; name: string; owner: string; due: string | null }[],
    doing: [] as { id: string; name: string; owner: string; due: string | null }[],
    done: [] as { id: string; name: string; owner: string; due: string | null }[],
  };

  (data as ProjectBoardRow[]).forEach((item) => {
    const status = item.status?.toLowerCase();
    const ownerName = item.owner_id ? ownerMap.get(item.owner_id) ?? item.owner_id : "Unassigned";
    const payload = { id: item.id, name: item.name, owner: ownerName, due: item.due_date };

    if (status === "done") {
      grouped.done.push(payload);
      return;
    }

    if (status === "doing" || status === "in_progress") {
      grouped.doing.push(payload);
      return;
    }

    grouped.todo.push(payload);
  });

  return grouped;
}

export async function getProjectManagementData(limit = DEFAULT_LIMIT): Promise<ProjectManagementData> {
  const supabase = createClient();

  if (!supabase) {
    return { projects: [], customers: [], owners: [], cases: [], pendingTransfers: [] };
  }

  const safeLimit = Math.min(Math.max(limit, 1), 200);

  const [projectResult, customerResult, ownerResult, casesResult, transfersResult] = await Promise.all([
    supabase.from("projects").select("id, name, description, status, owner_id, customer_id, due_date, commission_rate, active, is_template, require_customer_name, require_customer_phone, require_customer_address, require_face_photo, require_id_card, require_id_address, updated_at, created_at").order("created_at", { ascending: false }).limit(safeLimit),
    supabase.from("customers").select("id, name").order("name", { ascending: true }),
    supabase.from("users").select("id, full_name, active, role").eq("active", true).order("full_name", { ascending: true }),
    supabase.from("project_cases").select("id, project_id, customer_id, customer_name, customer_phone, customer_address, sales_owner_id, commission_owner_id, commission_rate, approval_status, lifecycle_status, opened_at, created_at").order("created_at", { ascending: false }).limit(safeLimit),
    supabase.from("project_case_transfers").select("id, project_case_id, from_sales_id, to_sales_id, reason, status, requested_by, approver_id, approved_at, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(safeLimit),
  ]);

  const customers = (customerResult.data ?? []).map((item) => ({ id: item.id, name: item.name }));
  const owners = (ownerResult.data ?? [])
    .filter((item) => item.role === "STAFF")
    .map((item) => ({ id: item.id, name: item.full_name }));
  const userMap = new Map((ownerResult.data ?? []).map((item) => [item.id, item.full_name]));
  const customerMap = new Map(customers.map((item) => [item.id, item.name]));

  const rawProjectRows = (projectResult.data ?? []) as Array<Record<string, unknown>>;
  const projects = rawProjectRows.map((row) => mapTemplateRow(row, userMap, customerMap));
  const templateMap = new Map(projects.map((item) => [item.id, item]));

  const projectCases = casesResult.error ? [] : mapProjectCases((casesResult.data ?? []) as ProjectCaseRow[], templateMap, userMap);
  const caseMap = new Map(projectCases.map((item) => [item.id, item]));
  const pendingTransfers = transfersResult.error
    ? []
    : mapTransfers((transfersResult.data ?? []) as ProjectTransferRow[], caseMap, userMap);

  return {
    projects,
    customers,
    owners,
    cases: projectCases,
    pendingTransfers,
  };
}

export async function getSalesProjectWorkspaceData(userId: string, limit = DEFAULT_LIMIT): Promise<SalesProjectWorkspaceData> {
  const supabase = createClient();

  if (!supabase) {
    return { templates: [], myCases: [], myTransfers: [], transferTargets: [] };
  }

  const safeLimit = Math.min(Math.max(limit, 1), 180);

  const [projectResult, ownerResult, myCasesResult, myTransfersResult] = await Promise.all([
    supabase.from("projects").select("id, name, description, status, owner_id, customer_id, due_date, commission_rate, active, is_template, require_customer_name, require_customer_phone, require_customer_address, require_face_photo, require_id_card, require_id_address, updated_at, created_at").order("created_at", { ascending: false }).limit(safeLimit),
    supabase.from("users").select("id, full_name, active, role").eq("active", true).order("full_name", { ascending: true }),
    supabase.from("project_cases").select("id, project_id, customer_id, customer_name, customer_phone, customer_address, sales_owner_id, commission_owner_id, commission_rate, approval_status, lifecycle_status, opened_at, created_at").eq("sales_owner_id", userId).order("created_at", { ascending: false }).limit(safeLimit),
    supabase
      .from("project_case_transfers")
      .select("id, project_case_id, from_sales_id, to_sales_id, reason, status, requested_by, approver_id, approved_at, created_at")
      .or(`requested_by.eq.${userId},to_sales_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(safeLimit),
  ]);

  const users = ownerResult.data ?? [];
  const userMap = new Map(users.map((item) => [item.id, item.full_name]));
  const transferTargets = users.filter((item) => item.role === "STAFF" && item.id !== userId).map((item) => ({ id: item.id, name: item.full_name }));

  const customerResult = await supabase.from("customers").select("id, name").order("name", { ascending: true });
  const customerMap = new Map((customerResult.data ?? []).map((item) => [item.id, item.name]));

  const rawProjectRows = (projectResult.data ?? []) as Array<Record<string, unknown>>;
  const templates = rawProjectRows
    .map((row) => mapTemplateRow(row, userMap, customerMap))
    .filter((item) => item.active && item.isTemplate);

  const templateMap = new Map(templates.map((item) => [item.id, item]));
  const myCases = myCasesResult.error ? [] : mapProjectCases((myCasesResult.data ?? []) as ProjectCaseRow[], templateMap, userMap);
  const caseMap = new Map(myCases.map((item) => [item.id, item]));
  const myTransfers = myTransfersResult.error ? [] : mapTransfers((myTransfersResult.data ?? []) as ProjectTransferRow[], caseMap, userMap);

  return {
    templates,
    myCases,
    myTransfers,
    transferTargets,
  };
}

export async function getTransferApprovalQueueData(limit = DEFAULT_LIMIT): Promise<ProjectTransferItem[]> {
  const supabase = createClient();

  if (!supabase) {
    return [];
  }

  const safeLimit = Math.min(Math.max(limit, 1), 180);

  const [transfersResult, casesResult, usersResult, projectResult] = await Promise.all([
    supabase.from("project_case_transfers").select("id, project_case_id, from_sales_id, to_sales_id, reason, status, requested_by, approver_id, approved_at, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(safeLimit),
    supabase.from("project_cases").select("id, project_id").order("created_at", { ascending: false }).limit(safeLimit),
    supabase.from("users").select("id, full_name").order("full_name", { ascending: true }),
    supabase.from("projects").select("id, name").order("created_at", { ascending: false }).limit(safeLimit),
  ]);

  if (transfersResult.error) {
    return [];
  }

  const userMap = new Map((usersResult.data ?? []).map((item) => [item.id, item.full_name]));
  const templateMap = new Map(
    ((projectResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [
      String(row.id ?? ""),
      {
        id: String(row.id ?? ""),
        name: String(row.name ?? "Untitled project"),
      },
    ]),
  );

  const caseMap = new Map(
    ((casesResult.data ?? []) as ProjectCaseRow[]).map((row) => [
      row.id,
      {
        projectName: templateMap.get(row.project_id)?.name ?? row.project_id,
      },
    ]),
  );

  return mapTransfers((transfersResult.data ?? []) as ProjectTransferRow[], caseMap as unknown as Map<string, ProjectCaseItem>, userMap);
}

export async function getProjectCommissionSettings(limit = DEFAULT_LIMIT): Promise<ProjectTemplateItem[]> {
  const data = await getProjectManagementData(limit);
  return data.projects;
}





export interface PaginatedResult<T> {
  items: T[];
  pageSize: number;
  hasNext: boolean;
  nextCursor: string | null;
}

interface PaginationQueryParams {
  pageSize?: number;
  search?: string | null;
  cursor?: string | null;
}

interface KeysetCursor {
  createdAt: string;
  id: string;
}

const DEFAULT_SERVER_PAGE_SIZE = 10;
const MAX_SERVER_PAGE_SIZE = 100;
const CURSOR_SEPARATOR = "::";

function normalizePaginationQuery(params?: PaginationQueryParams) {
  const rawPageSize = Number(params?.pageSize ?? DEFAULT_SERVER_PAGE_SIZE);

  const pageSize = Number.isFinite(rawPageSize)
    ? Math.min(MAX_SERVER_PAGE_SIZE, Math.max(1, Math.trunc(rawPageSize)))
    : DEFAULT_SERVER_PAGE_SIZE;

  return { pageSize };
}

function sanitizeSearchTerm(search?: string | null) {
  const normalized = String(search ?? "")
    .trim()
    .replace(/[,%*]/g, " ")
    .replace(/\s+/g, " ");

  return normalized;
}

function encodeCursor(cursor: KeysetCursor): string {
  return Buffer.from(`${cursor.createdAt}${CURSOR_SEPARATOR}${cursor.id}`, "utf8").toString("base64");
}

function decodeCursor(cursor?: string | null): KeysetCursor | null {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const [createdAt, id] = decoded.split(CURSOR_SEPARATOR);

    if (!createdAt || !id) {
      return null;
    }

    if (Number.isNaN(new Date(createdAt).getTime())) {
      return null;
    }

    return { createdAt, id };
  } catch {
    return null;
  }
}

function buildPaginationResult<T>(items: T[], pageSize: number, hasNext: boolean, nextCursor: string | null): PaginatedResult<T> {
  return {
    items,
    pageSize,
    hasNext,
    nextCursor,
  };
}

async function findUserIdsByName(supabase: NonNullable<ReturnType<typeof createClient>>, term: string, limit = 120) {
  const { data } = await supabase
    .from("users")
    .select("id")
    .ilike("full_name", `%${term}%`)
    .limit(limit);

  return (data ?? []).map((item) => item.id);
}

async function findProjectIdsByName(supabase: NonNullable<ReturnType<typeof createClient>>, term: string, limit = 120) {
  const { data } = await supabase
    .from("projects")
    .select("id")
    .ilike("name", `%${term}%`)
    .limit(limit);

  return (data ?? []).map((item) => item.id);
}

function applyCreatedAtCursorFilter<TQuery extends { lt: (column: string, value: string) => TQuery }>(
  query: TQuery,
  cursor: KeysetCursor | null,
) {
  if (!cursor) {
    return query;
  }

  return query.lt("created_at", cursor.createdAt);
}

export async function getProjectTemplatesPage(params: PaginationQueryParams = {}): Promise<PaginatedResult<ProjectTemplateItem>> {
  const supabase = createClient();

  if (!supabase) {
    return buildPaginationResult([], normalizePaginationQuery(params).pageSize, false, null);
  }

  const { pageSize } = normalizePaginationQuery(params);
  const term = sanitizeSearchTerm(params.search);
  const cursor = decodeCursor(params.cursor);

  let dataQuery = supabase
    .from("projects")
    .select("id, name, description, status, owner_id, customer_id, due_date, commission_rate, active, is_template, require_customer_name, require_customer_phone, require_customer_address, require_face_photo, require_id_card, require_id_address, updated_at, created_at")
    .eq("is_template", true);

  if (term) {
    dataQuery = dataQuery.or(`name.ilike.%${term}%,description.ilike.%${term}%,status.ilike.%${term}%`);
  }

  dataQuery = applyCreatedAtCursorFilter(dataQuery, cursor);

  const projectResult = await dataQuery.order("created_at", { ascending: false }).limit(pageSize + 1);

  const allRows = (projectResult.data ?? []) as Array<Record<string, unknown>>;
  const visibleRows = allRows.slice(0, pageSize);

  const ownerIds = Array.from(
    new Set(visibleRows.map((row) => (typeof row.owner_id === "string" ? row.owner_id : null)).filter((id): id is string => Boolean(id))),
  );
  const customerIds = Array.from(
    new Set(visibleRows.map((row) => (typeof row.customer_id === "string" ? row.customer_id : null)).filter((id): id is string => Boolean(id))),
  );

  const [ownerResult, customerResult] = await Promise.all([
    ownerIds.length > 0 ? supabase.from("users").select("id, full_name").in("id", ownerIds) : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
    customerIds.length > 0 ? supabase.from("customers").select("id, name").in("id", customerIds) : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const ownerMap = buildOwnerMap(ownerResult.data);
  const customerMap = new Map((customerResult.data ?? []).map((item) => [item.id, item.name]));
  const items = visibleRows.map((row) => mapTemplateRow(row, ownerMap, customerMap));

  const hasNext = allRows.length > pageSize;
  const lastRow = visibleRows[visibleRows.length - 1];
  const nextCursor =
    hasNext && lastRow && typeof lastRow.created_at === "string" && typeof lastRow.id === "string"
      ? encodeCursor({ createdAt: lastRow.created_at, id: lastRow.id })
      : null;

  return buildPaginationResult(items, pageSize, hasNext, nextCursor);
}

export async function getProjectCasesPage(params: PaginationQueryParams = {}): Promise<PaginatedResult<ProjectCaseItem>> {
  const supabase = createClient();

  if (!supabase) {
    return buildPaginationResult([], normalizePaginationQuery(params).pageSize, false, null);
  }

  const { pageSize } = normalizePaginationQuery(params);
  const term = sanitizeSearchTerm(params.search);
  const cursor = decodeCursor(params.cursor);

  let userIds: string[] = [];
  let projectIds: string[] = [];

  if (term) {
    [userIds, projectIds] = await Promise.all([findUserIdsByName(supabase, term), findProjectIdsByName(supabase, term)]);
  }

  const searchFilters = [
    term ? `customer_name.ilike.%${term}%` : "",
    term ? `customer_phone.ilike.%${term}%` : "",
    term ? `customer_address.ilike.%${term}%` : "",
    term ? `approval_status.ilike.%${term}%` : "",
    term ? `lifecycle_status.ilike.%${term}%` : "",
    userIds.length > 0 ? `sales_owner_id.in.(${userIds.join(",")})` : "",
    userIds.length > 0 ? `commission_owner_id.in.(${userIds.join(",")})` : "",
    projectIds.length > 0 ? `project_id.in.(${projectIds.join(",")})` : "",
  ].filter(Boolean);

  let dataQuery = supabase
    .from("project_cases")
    .select("id, project_id, customer_id, customer_name, customer_phone, customer_address, sales_owner_id, commission_owner_id, commission_rate, approval_status, lifecycle_status, opened_at, created_at")
    .order("created_at", { ascending: false })
    .limit(pageSize + 1);

  if (searchFilters.length > 0) {
    dataQuery = dataQuery.or(searchFilters.join(","));
  }

  dataQuery = applyCreatedAtCursorFilter(dataQuery, cursor);

  const caseResult = await dataQuery;
  const allRows = (caseResult.data ?? []) as ProjectCaseRow[];
  const rows = allRows.slice(0, pageSize);

  const caseProjectIds = Array.from(new Set(rows.map((item) => item.project_id)));
  const caseUserIds = Array.from(
    new Set(rows.flatMap((item) => [item.sales_owner_id, item.commission_owner_id]).filter((id): id is string => Boolean(id))),
  );

  const [projectResult, userResult] = await Promise.all([
    caseProjectIds.length > 0 ? supabase.from("projects").select("id, name").in("id", caseProjectIds) : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    caseUserIds.length > 0 ? supabase.from("users").select("id, full_name").in("id", caseUserIds) : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
  ]);

  const projectMap = new Map((projectResult.data ?? []).map((item) => [item.id, item.name]));
  const userMap = new Map((userResult.data ?? []).map((item) => [item.id, item.full_name]));

  const items: ProjectCaseItem[] = rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    projectName: projectMap.get(row.project_id) ?? row.project_id,
    customerName: row.customer_name ?? "-",
    customerPhone: row.customer_phone ?? "-",
    customerAddress: row.customer_address ?? "-",
    ownerId: row.sales_owner_id,
    ownerName: userMap.get(row.sales_owner_id) ?? row.sales_owner_id,
    commissionOwnerId: row.commission_owner_id,
    commissionOwnerName: userMap.get(row.commission_owner_id) ?? row.commission_owner_id,
    commissionRate: normalizeRate(row.commission_rate),
    approvalStatus: row.approval_status,
    lifecycleStatus: row.lifecycle_status,
    openedAt: row.opened_at,
    createdAt: row.created_at,
  }));

  const hasNext = allRows.length > pageSize;
  const lastRow = rows[rows.length - 1];
  const nextCursor = hasNext && lastRow ? encodeCursor({ createdAt: lastRow.created_at, id: lastRow.id }) : null;

  return buildPaginationResult(items, pageSize, hasNext, nextCursor);
}

export async function getProjectTransfersPage(params: PaginationQueryParams = {}): Promise<PaginatedResult<ProjectTransferItem>> {
  const supabase = createClient();

  if (!supabase) {
    return buildPaginationResult([], normalizePaginationQuery(params).pageSize, false, null);
  }

  const { pageSize } = normalizePaginationQuery(params);
  const term = sanitizeSearchTerm(params.search);
  const cursor = decodeCursor(params.cursor);

  let userIds: string[] = [];
  let caseIdsFromProjectName: string[] = [];

  if (term) {
    userIds = await findUserIdsByName(supabase, term);

    const projectIds = await findProjectIdsByName(supabase, term);
    if (projectIds.length > 0) {
      const { data: matchCases } = await supabase.from("project_cases").select("id").in("project_id", projectIds).limit(200);
      caseIdsFromProjectName = (matchCases ?? []).map((item) => item.id);
    }
  }

  const searchFilters = [
    term ? `reason.ilike.%${term}%` : "",
    term ? `status.ilike.%${term}%` : "",
    userIds.length > 0 ? `from_sales_id.in.(${userIds.join(",")})` : "",
    userIds.length > 0 ? `to_sales_id.in.(${userIds.join(",")})` : "",
    userIds.length > 0 ? `requested_by.in.(${userIds.join(",")})` : "",
    caseIdsFromProjectName.length > 0 ? `project_case_id.in.(${caseIdsFromProjectName.join(",")})` : "",
  ].filter(Boolean);

  let dataQuery = supabase
    .from("project_case_transfers")
    .select("id, project_case_id, from_sales_id, to_sales_id, reason, status, requested_by, approver_id, approved_at, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(pageSize + 1);

  if (searchFilters.length > 0) {
    dataQuery = dataQuery.or(searchFilters.join(","));
  }

  dataQuery = applyCreatedAtCursorFilter(dataQuery, cursor);

  const transferResult = await dataQuery;
  const allRows = (transferResult.data ?? []) as ProjectTransferRow[];
  const rows = allRows.slice(0, pageSize);

  const relatedCaseIds = Array.from(new Set(rows.map((item) => item.project_case_id)));
  const relatedUserIds = Array.from(
    new Set(
      rows
        .flatMap((item) => [item.from_sales_id, item.to_sales_id, item.requested_by, item.approver_id])
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [caseResult, userResult] = await Promise.all([
    relatedCaseIds.length > 0 ? supabase.from("project_cases").select("id, project_id").in("id", relatedCaseIds) : Promise.resolve({ data: [] as Array<{ id: string; project_id: string }> }),
    relatedUserIds.length > 0 ? supabase.from("users").select("id, full_name").in("id", relatedUserIds) : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
  ]);

  const caseRows = caseResult.data ?? [];
  const projectIds = Array.from(new Set(caseRows.map((item) => item.project_id)));
  const projectResult = projectIds.length > 0 ? await supabase.from("projects").select("id, name").in("id", projectIds) : { data: [] as Array<{ id: string; name: string }> };

  const projectMap = new Map((projectResult.data ?? []).map((item) => [item.id, item.name]));
  const caseProjectMap = new Map(caseRows.map((item) => [item.id, projectMap.get(item.project_id) ?? item.project_id]));
  const userMap = new Map((userResult.data ?? []).map((item) => [item.id, item.full_name]));

  const items: ProjectTransferItem[] = rows.map((row) => ({
    id: row.id,
    projectCaseId: row.project_case_id,
    projectName: caseProjectMap.get(row.project_case_id) ?? row.project_case_id,
    fromSalesId: row.from_sales_id,
    fromSalesName: userMap.get(row.from_sales_id) ?? row.from_sales_id,
    toSalesId: row.to_sales_id,
    toSalesName: userMap.get(row.to_sales_id) ?? row.to_sales_id,
    reason: row.reason ?? "",
    status: row.status,
    requestedBy: row.requested_by,
    requestedByName: userMap.get(row.requested_by) ?? row.requested_by,
    approverId: row.approver_id,
    approverName: row.approver_id ? userMap.get(row.approver_id) ?? row.approver_id : "-",
    approvedAt: row.approved_at,
    createdAt: row.created_at,
  }));

  const hasNext = allRows.length > pageSize;
  const lastRow = rows[rows.length - 1];
  const nextCursor = hasNext && lastRow ? encodeCursor({ createdAt: lastRow.created_at, id: lastRow.id }) : null;

  return buildPaginationResult(items, pageSize, hasNext, nextCursor);
}
