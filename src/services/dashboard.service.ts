import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/types";
import { activityFeed, dashboardSeries } from "@/services/mock-data";

type DashboardMode = "executive" | "sales";

interface DashboardSeriesPoint {
  month: string;
  revenue: number;
}

interface DashboardActivityItem {
  id: string;
  actor: string;
  action: string;
  at: string;
}

interface DashboardMetrics {
  mode: DashboardMode;
  kpis: {
    revenue: number;
    commission: number;
    activeProjects: number;
    pendingApprovals: number;
    signedDocuments: number;
  };
  series: DashboardSeriesPoint[];
  activity: DashboardActivityItem[];
}

interface InvoiceRow {
  amount: number;
  status: string;
  created_at: string;
  customer_id?: string | null;
  project_id?: string | null;
}

interface ProjectCommissionRow {
  id: string;
  customer_id: string | null;
  status: string;
  commission_rate: number;
  created_at: string;
}

function fallbackExecutiveMetrics(): DashboardMetrics {
  return {
    mode: "executive",
    kpis: {
      revenue: 67000,
      commission: 0,
      activeProjects: 16,
      pendingApprovals: 7,
      signedDocuments: 43,
    },
    series: dashboardSeries,
    activity: activityFeed,
  };
}

function fallbackSalesMetrics(): DashboardMetrics {
  return {
    mode: "sales",
    kpis: {
      revenue: 67000,
      commission: 0,
      activeProjects: 0,
      pendingApprovals: 0,
      signedDocuments: 0,
    },
    series: dashboardSeries,
    activity: activityFeed,
  };
}

function getLastSixMonthsWindow() {
  const months: { key: string; label: string }[] = [];
  const now = new Date();

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleString("en-US", { month: "short" }),
    });
  }

  return months;
}

function buildSeriesFromInvoices(invoices: InvoiceRow[]) {
  const windowMonths = getLastSixMonthsWindow();
  const totals = new Map(windowMonths.map((item) => [item.key, 0]));

  for (const invoice of invoices) {
    const parsedDate = new Date(invoice.created_at);

    if (Number.isNaN(parsedDate.getTime())) {
      continue;
    }

    const key = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}`;

    if (!totals.has(key)) {
      continue;
    }

    totals.set(key, (totals.get(key) ?? 0) + Number(invoice.amount || 0));
  }

  return windowMonths.map((item) => ({
    month: item.label,
    revenue: totals.get(item.key) ?? 0,
  }));
}

function toActivityFromNotifications(notifications: Array<{ id: string; title: string; body: string; created_at: string }>, actor: string) {
  return notifications.map((item) => ({
    id: item.id,
    actor,
    action: `${item.title} - ${item.body}`,
    at: item.created_at,
  }));
}

function isSalesUser(user: UserProfile | null | undefined) {
  if (!user) {
    return false;
  }

  const department = (user.department || "").toLowerCase();
  return user.role === "STAFF" || department.includes("sales");
}

function normalizeRate(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(100, Math.max(0, parsed));
}

function toProjectCommissionRows(rows: unknown[] | null | undefined): ProjectCommissionRow[] {
  if (!rows) {
    return [];
  }

  return rows
    .map((item) => {
      const row = item as Record<string, unknown>;

      return {
        id: String(row.id ?? ""),
        customer_id: typeof row.customer_id === "string" ? row.customer_id : null,
        status: typeof row.status === "string" ? row.status : "todo",
        commission_rate: normalizeRate(row.commission_rate),
        created_at: typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString(),
      };
    })
    .filter((item) => item.id.length > 0);
}

function toInvoiceRows(rows: unknown[] | null | undefined): InvoiceRow[] {
  if (!rows) {
    return [];
  }

  return rows
    .map((item) => {
      const row = item as Record<string, unknown>;
      const amount = Number(row.amount ?? 0);

      return {
        amount: Number.isFinite(amount) ? amount : 0,
        status: typeof row.status === "string" ? row.status : "pending",
        created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
        customer_id: typeof row.customer_id === "string" ? row.customer_id : null,
        project_id: typeof row.project_id === "string" ? row.project_id : null,
      };
    })
    .filter((item) => item.created_at.length > 0);
}

function buildCustomerRateMap(projects: ProjectCommissionRow[]) {
  const sorted = [...projects].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    return bTime - aTime;
  });

  const byCustomer = new Map<string, number>();

  for (const project of sorted) {
    if (!project.customer_id || byCustomer.has(project.customer_id)) {
      continue;
    }

    byCustomer.set(project.customer_id, project.commission_rate);
  }

  return byCustomer;
}

function calculateCommission(invoices: InvoiceRow[], projects: ProjectCommissionRow[]) {
  const projectRateMap = new Map(projects.map((item) => [item.id, item.commission_rate]));
  const customerRateMap = buildCustomerRateMap(projects);

  const total = invoices.reduce((sum, invoice) => {
    let rate = 0;

    if (invoice.project_id && projectRateMap.has(invoice.project_id)) {
      rate = projectRateMap.get(invoice.project_id) ?? 0;
    } else if (invoice.customer_id && customerRateMap.has(invoice.customer_id)) {
      rate = customerRateMap.get(invoice.customer_id) ?? 0;
    }

    return sum + Number(invoice.amount || 0) * (rate / 100);
  }, 0);

  return Math.round(total);
}

function countActiveProjects(projects: ProjectCommissionRow[]) {
  return projects.filter((project) => {
    const status = project.status.toLowerCase();
    return status === "active" || status === "in_progress" || status === "doing";
  }).length;
}

export async function getDashboardMetrics(user?: UserProfile | null): Promise<DashboardMetrics> {
  const supabase = createClient();
  const salesMode = isSalesUser(user);

  if (!supabase) {
    return salesMode ? fallbackSalesMetrics() : fallbackExecutiveMetrics();
  }

  if (salesMode && user) {
    const [ownedCustomersResult, ownedProjectsResult] = await Promise.all([
      supabase.from("customers").select("id").eq("owner_id", user.id),
      supabase.from("projects").select("*").eq("owner_id", user.id),
    ]);

    if (ownedCustomersResult.error || ownedProjectsResult.error) {
      return fallbackSalesMetrics();
    }

    const ownedCustomerIds = (ownedCustomersResult.data ?? []).map((item) => item.id);
    const ownedProjects = toProjectCommissionRows(ownedProjectsResult.data as unknown[] | null | undefined);

    const [invoiceResult, approvalResult, signatureResult, notificationResult] = await Promise.all([
      ownedCustomerIds.length > 0
        ? supabase.from("invoices").select("*").in("customer_id", ownedCustomerIds)
        : Promise.resolve({ data: [] as unknown[], error: null }),
      supabase.from("approvals").select("id", { count: "exact", head: true }).eq("requester_id", user.id).eq("status", "pending"),
      supabase.from("signatures").select("id", { count: "exact", head: true }).eq("signer_id", user.id),
      supabase.from("notifications").select("id, title, body, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6),
    ]);

    if (invoiceResult.error) {
      return fallbackSalesMetrics();
    }

    const invoices = toInvoiceRows(invoiceResult.data as unknown[] | null | undefined);
    const salesRevenue = invoices.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const commission = calculateCommission(invoices, ownedProjects);

    return {
      mode: "sales",
      kpis: {
        revenue: salesRevenue,
        commission,
        activeProjects: countActiveProjects(ownedProjects),
        pendingApprovals: approvalResult.count ?? 0,
        signedDocuments: signatureResult.count ?? 0,
      },
      series: buildSeriesFromInvoices(invoices),
      activity:
        notificationResult.data && notificationResult.data.length > 0
          ? toActivityFromNotifications(notificationResult.data, user.full_name)
          : activityFeed,
    };
  }

  const [projectResult, approvalResult, signatureResult, invoiceResult] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("signatures").select("id", { count: "exact", head: true }),
    supabase.from("invoices").select("amount, created_at, status"),
  ]);

  if (invoiceResult.error) {
    return fallbackExecutiveMetrics();
  }

  const allInvoices = (invoiceResult.data ?? []) as InvoiceRow[];

  return {
    mode: "executive",
    kpis: {
      revenue: allInvoices.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      commission: 0,
      activeProjects: projectResult.count ?? 0,
      pendingApprovals: approvalResult.count ?? 0,
      signedDocuments: signatureResult.count ?? 0,
    },
    series: buildSeriesFromInvoices(allInvoices),
    activity: activityFeed,
  };
}
