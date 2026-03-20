import { createClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 120;

interface SalesProfileRow {
  id: string;
  user_id: string | null;
  employee_code: string | null;
  full_name: string;
  phone: string | null;
  current_address: string | null;
  id_card_address: string | null;
  id_card_number: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  manager_user_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface SalesProfileDocumentRow {
  id: string;
  sales_profile_id: string;
  document_type: string;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

interface SalesCommissionCycleRow {
  id: string;
  sales_profile_id: string;
  cycle_label: string | null;
  period_start: string;
  period_end: string;
  payout_window_start: string;
  payout_window_end: string;
  gross_sales: number;
  approved_sales: number;
  commission_rate_avg: number;
  commission_amount: number;
  status: string;
  submitted_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesProfileDocumentItem {
  id: string;
  type: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
}

export interface SalesProfileItem {
  id: string;
  userId: string | null;
  userName: string;
  employeeCode: string;
  fullName: string;
  phone: string;
  currentAddress: string;
  idCardAddress: string;
  idCardNumber: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  managerUserId: string | null;
  managerName: string;
  notes: string;
  createdBy: string | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  documents: SalesProfileDocumentItem[];
}

export interface SalesCommissionCycleItem {
  id: string;
  profileId: string;
  profileName: string;
  cycleLabel: string;
  periodStart: string;
  periodEnd: string;
  payoutWindowStart: string;
  payoutWindowEnd: string;
  grossSales: number;
  approvedSales: number;
  commissionRateAvg: number;
  commissionAmount: number;
  status: string;
  submittedBy: string | null;
  submittedByName: string;
  approvedBy: string | null;
  approvedByName: string;
  approvedAt: string | null;
  paidAt: string | null;
  notes: string;
  createdAt: string;
}

export interface SalesOption {
  id: string;
  name: string;
}

export interface SalesTeamData {
  profiles: SalesProfileItem[];
  cycles: SalesCommissionCycleItem[];
  staffUsers: SalesOption[];
  managers: SalesOption[];
}

export interface SalesTeamMetaOptions {
  staffUsers: SalesOption[];
  managers: SalesOption[];
}

function mapSalesTeamMetaOptions(userRows: Array<{ id: string; full_name: string; role: string }>): SalesTeamMetaOptions {
  const staffUsers = userRows.filter((item) => item.role === "STAFF").map((item) => ({ id: item.id, name: item.full_name }));
  const managers = userRows
    .filter((item) => item.role === "CEO" || item.role === "MANAGER" || item.role === "HEAD")
    .map((item) => ({ id: item.id, name: item.full_name }));

  return { staffUsers, managers };
}

function toSafeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getSalesTeamMetaOptions(): Promise<SalesTeamMetaOptions> {
  const supabase = createClient();

  if (!supabase) {
    return { staffUsers: [], managers: [] };
  }

  const { data } = await supabase
    .from("users")
    .select("id, full_name, role")
    .eq("active", true)
    .order("full_name", { ascending: true });

  const users = (data ?? []) as Array<{ id: string; full_name: string; role: string }>;
  return mapSalesTeamMetaOptions(users);
}

export async function getSalesTeamData(limit = DEFAULT_LIMIT): Promise<SalesTeamData> {
  const supabase = createClient();

  if (!supabase) {
    return {
      profiles: [],
      cycles: [],
      staffUsers: [],
      managers: [],
    };
  }

  const safeLimit = Math.min(Math.max(limit, 1), 300);

  const [profileResult, docsResult, cyclesResult, usersResult] = await Promise.all([
    supabase.from("sales_profiles").select("id, user_id, employee_code, full_name, phone, current_address, id_card_address, id_card_number, status, start_date, end_date, manager_user_id, notes, created_by, created_at, updated_at").order("created_at", { ascending: false }).limit(safeLimit),
    supabase.from("sales_profile_documents").select("id, sales_profile_id, document_type, file_path, file_name, mime_type, uploaded_by, created_at").order("created_at", { ascending: false }).limit(safeLimit),
    supabase.from("sales_commission_cycles").select("id, sales_profile_id, cycle_label, period_start, period_end, payout_window_start, payout_window_end, gross_sales, approved_sales, commission_rate_avg, commission_amount, status, submitted_by, approved_by, approved_at, paid_at, notes, created_at, updated_at").order("created_at", { ascending: false }).limit(safeLimit),
    supabase.from("users").select("id, full_name, role, active").eq("active", true).order("full_name", { ascending: true }),
  ]);

  const userRows = usersResult.data ?? [];
  const userMap = new Map(userRows.map((item) => [item.id, item.full_name]));

  const docsByProfile = new Map<string, SalesProfileDocumentItem[]>();

  for (const row of (docsResult.data ?? []) as SalesProfileDocumentRow[]) {
    const mapped: SalesProfileDocumentItem = {
      id: row.id,
      type: row.document_type,
      filePath: row.file_path,
      fileName: row.file_name ?? row.file_path,
      mimeType: row.mime_type ?? "application/octet-stream",
      createdAt: row.created_at,
    };

    const current = docsByProfile.get(row.sales_profile_id) ?? [];
    current.push(mapped);
    docsByProfile.set(row.sales_profile_id, current);
  }

  const profiles = ((profileResult.data ?? []) as SalesProfileRow[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_id ? userMap.get(row.user_id) ?? row.user_id : "-",
    employeeCode: row.employee_code ?? "-",
    fullName: row.full_name,
    phone: row.phone ?? "-",
    currentAddress: row.current_address ?? "-",
    idCardAddress: row.id_card_address ?? "-",
    idCardNumber: row.id_card_number ?? "-",
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    managerUserId: row.manager_user_id,
    managerName: row.manager_user_id ? userMap.get(row.manager_user_id) ?? row.manager_user_id : "-",
    notes: row.notes ?? "",
    createdBy: row.created_by,
    createdByName: row.created_by ? userMap.get(row.created_by) ?? row.created_by : "-",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    documents: docsByProfile.get(row.id) ?? [],
  }));

  const profileMap = new Map(profiles.map((item) => [item.id, item.fullName]));

  const cycles = ((cyclesResult.data ?? []) as SalesCommissionCycleRow[]).map((row) => ({
    id: row.id,
    profileId: row.sales_profile_id,
    profileName: profileMap.get(row.sales_profile_id) ?? row.sales_profile_id,
    cycleLabel: row.cycle_label ?? `${row.period_start} - ${row.period_end}`,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    payoutWindowStart: row.payout_window_start,
    payoutWindowEnd: row.payout_window_end,
    grossSales: toSafeNumber(row.gross_sales),
    approvedSales: toSafeNumber(row.approved_sales),
    commissionRateAvg: toSafeNumber(row.commission_rate_avg),
    commissionAmount: toSafeNumber(row.commission_amount),
    status: row.status,
    submittedBy: row.submitted_by,
    submittedByName: row.submitted_by ? userMap.get(row.submitted_by) ?? row.submitted_by : "-",
    approvedBy: row.approved_by,
    approvedByName: row.approved_by ? userMap.get(row.approved_by) ?? row.approved_by : "-",
    approvedAt: row.approved_at,
    paidAt: row.paid_at,
    notes: row.notes ?? "",
    createdAt: row.created_at,
  }));

  const staffUsers = userRows.filter((item) => item.role === "STAFF").map((item) => ({ id: item.id, name: item.full_name }));
  const managers = userRows
    .filter((item) => item.role === "CEO" || item.role === "MANAGER" || item.role === "HEAD")
    .map((item) => ({ id: item.id, name: item.full_name }));

  return {
    profiles,
    cycles,
    staffUsers,
    managers,
  };
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
  return String(search ?? "")
    .trim()
    .replace(/[,%*]/g, " ")
    .replace(/\s+/g, " ");
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

function applyCreatedAtCursorFilter<TQuery extends { lt: (column: string, value: string) => TQuery }>(
  query: TQuery,
  cursor: KeysetCursor | null,
) {
  if (!cursor) {
    return query;
  }

  return query.lt("created_at", cursor.createdAt);
}

async function findUserIdsByName(supabase: NonNullable<ReturnType<typeof createClient>>, term: string, limit = 150) {
  const { data } = await supabase.from("users").select("id").ilike("full_name", `%${term}%`).limit(limit);

  return (data ?? []).map((item) => item.id);
}

export async function getSalesProfilesPage(params: PaginationQueryParams = {}): Promise<PaginatedResult<SalesProfileItem>> {
  const supabase = createClient();

  if (!supabase) {
    return buildPaginationResult([], normalizePaginationQuery(params).pageSize, false, null);
  }

  const { pageSize } = normalizePaginationQuery(params);
  const term = sanitizeSearchTerm(params.search);
  const cursor = decodeCursor(params.cursor);

  let relatedUserIds: string[] = [];

  if (term) {
    relatedUserIds = await findUserIdsByName(supabase, term);
  }

  const searchFilters = [
    term ? `full_name.ilike.%${term}%` : "",
    term ? `employee_code.ilike.%${term}%` : "",
    term ? `phone.ilike.%${term}%` : "",
    term ? `id_card_number.ilike.%${term}%` : "",
    term ? `status.ilike.%${term}%` : "",
    relatedUserIds.length > 0 ? `user_id.in.(${relatedUserIds.join(",")})` : "",
    relatedUserIds.length > 0 ? `manager_user_id.in.(${relatedUserIds.join(",")})` : "",
  ].filter(Boolean);

  let profileQuery = supabase
    .from("sales_profiles")
    .select("id, user_id, employee_code, full_name, phone, current_address, id_card_address, id_card_number, status, start_date, end_date, manager_user_id, notes, created_by, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(pageSize + 1);

  if (searchFilters.length > 0) {
    profileQuery = profileQuery.or(searchFilters.join(","));
  }

  profileQuery = applyCreatedAtCursorFilter(profileQuery, cursor);

  const profileResult = await profileQuery;
  const allRows = (profileResult.data ?? []) as SalesProfileRow[];
  const profileRows = allRows.slice(0, pageSize);

  const profileIds = profileRows.map((item) => item.id);
  const userIds = Array.from(
    new Set(
      profileRows
        .flatMap((item) => [item.user_id, item.manager_user_id, item.created_by])
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [docsResult, usersResult] = await Promise.all([
    profileIds.length > 0
      ? supabase.from("sales_profile_documents").select("id, sales_profile_id, document_type, file_path, file_name, mime_type, uploaded_by, created_at").in("sales_profile_id", profileIds)
      : Promise.resolve({ data: [] as SalesProfileDocumentRow[] }),
    userIds.length > 0 ? supabase.from("users").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
  ]);

  const userMap = new Map((usersResult.data ?? []).map((item) => [item.id, item.full_name]));
  const docsByProfile = new Map<string, SalesProfileDocumentItem[]>();

  for (const row of (docsResult.data ?? []) as SalesProfileDocumentRow[]) {
    const mapped: SalesProfileDocumentItem = {
      id: row.id,
      type: row.document_type,
      filePath: row.file_path,
      fileName: row.file_name ?? row.file_path,
      mimeType: row.mime_type ?? "application/octet-stream",
      createdAt: row.created_at,
    };

    const current = docsByProfile.get(row.sales_profile_id) ?? [];
    current.push(mapped);
    docsByProfile.set(row.sales_profile_id, current);
  }

  const items: SalesProfileItem[] = profileRows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_id ? userMap.get(row.user_id) ?? row.user_id : "-",
    employeeCode: row.employee_code ?? "-",
    fullName: row.full_name,
    phone: row.phone ?? "-",
    currentAddress: row.current_address ?? "-",
    idCardAddress: row.id_card_address ?? "-",
    idCardNumber: row.id_card_number ?? "-",
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    managerUserId: row.manager_user_id,
    managerName: row.manager_user_id ? userMap.get(row.manager_user_id) ?? row.manager_user_id : "-",
    notes: row.notes ?? "",
    createdBy: row.created_by,
    createdByName: row.created_by ? userMap.get(row.created_by) ?? row.created_by : "-",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    documents: docsByProfile.get(row.id) ?? [],
  }));

  const hasNext = allRows.length > pageSize;
  const lastRow = profileRows[profileRows.length - 1];
  const nextCursor = hasNext && lastRow ? encodeCursor({ createdAt: lastRow.created_at, id: lastRow.id }) : null;

  return buildPaginationResult(items, pageSize, hasNext, nextCursor);
}

export async function getSalesCommissionCyclesPage(params: PaginationQueryParams = {}): Promise<PaginatedResult<SalesCommissionCycleItem>> {
  const supabase = createClient();

  if (!supabase) {
    return buildPaginationResult([], normalizePaginationQuery(params).pageSize, false, null);
  }

  const { pageSize } = normalizePaginationQuery(params);
  const term = sanitizeSearchTerm(params.search);
  const cursor = decodeCursor(params.cursor);

  let matchingProfileIds: string[] = [];

  if (term) {
    const { data } = await supabase.from("sales_profiles").select("id").ilike("full_name", `%${term}%`).limit(150);
    matchingProfileIds = (data ?? []).map((item) => item.id);
  }

  const searchFilters = [
    term ? `cycle_label.ilike.%${term}%` : "",
    term ? `status.ilike.%${term}%` : "",
    matchingProfileIds.length > 0 ? `sales_profile_id.in.(${matchingProfileIds.join(",")})` : "",
  ].filter(Boolean);

  let cycleQuery = supabase
    .from("sales_commission_cycles")
    .select("id, sales_profile_id, cycle_label, period_start, period_end, payout_window_start, payout_window_end, gross_sales, approved_sales, commission_rate_avg, commission_amount, status, submitted_by, approved_by, approved_at, paid_at, notes, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(pageSize + 1);

  if (searchFilters.length > 0) {
    cycleQuery = cycleQuery.or(searchFilters.join(","));
  }

  cycleQuery = applyCreatedAtCursorFilter(cycleQuery, cursor);

  const cycleResult = await cycleQuery;
  const allRows = (cycleResult.data ?? []) as SalesCommissionCycleRow[];
  const cycleRows = allRows.slice(0, pageSize);

  const profileIds = Array.from(new Set(cycleRows.map((item) => item.sales_profile_id)));
  const userIds = Array.from(
    new Set(cycleRows.flatMap((item) => [item.submitted_by, item.approved_by]).filter((id): id is string => Boolean(id))),
  );

  const [profileResult, userResult] = await Promise.all([
    profileIds.length > 0 ? supabase.from("sales_profiles").select("id, full_name").in("id", profileIds) : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
    userIds.length > 0 ? supabase.from("users").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
  ]);

  const profileMap = new Map((profileResult.data ?? []).map((item) => [item.id, item.full_name]));
  const userMap = new Map((userResult.data ?? []).map((item) => [item.id, item.full_name]));

  const items: SalesCommissionCycleItem[] = cycleRows.map((row) => ({
    id: row.id,
    profileId: row.sales_profile_id,
    profileName: profileMap.get(row.sales_profile_id) ?? row.sales_profile_id,
    cycleLabel: row.cycle_label ?? `${row.period_start} - ${row.period_end}`,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    payoutWindowStart: row.payout_window_start,
    payoutWindowEnd: row.payout_window_end,
    grossSales: toSafeNumber(row.gross_sales),
    approvedSales: toSafeNumber(row.approved_sales),
    commissionRateAvg: toSafeNumber(row.commission_rate_avg),
    commissionAmount: toSafeNumber(row.commission_amount),
    status: row.status,
    submittedBy: row.submitted_by,
    submittedByName: row.submitted_by ? userMap.get(row.submitted_by) ?? row.submitted_by : "-",
    approvedBy: row.approved_by,
    approvedByName: row.approved_by ? userMap.get(row.approved_by) ?? row.approved_by : "-",
    approvedAt: row.approved_at,
    paidAt: row.paid_at,
    notes: row.notes ?? "",
    createdAt: row.created_at,
  }));

  const hasNext = allRows.length > pageSize;
  const lastRow = cycleRows[cycleRows.length - 1];
  const nextCursor = hasNext && lastRow ? encodeCursor({ createdAt: lastRow.created_at, id: lastRow.id }) : null;

  return buildPaginationResult(items, pageSize, hasNext, nextCursor);
}

export async function getSalesProfileOptions(limit = 500): Promise<SalesOption[]> {
  const supabase = createClient();

  if (!supabase) {
    return [];
  }

  const safeLimit = Math.min(Math.max(limit, 1), 1000);
  const { data } = await supabase.from("sales_profiles").select("id, full_name").order("full_name", { ascending: true }).limit(safeLimit);

  return (data ?? []).map((item) => ({ id: item.id, name: item.full_name }));
}
