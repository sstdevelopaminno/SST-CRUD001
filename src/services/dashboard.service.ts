import { createClient } from "@/lib/supabase/server";
import { activityFeed, dashboardSeries } from "@/services/mock-data";

export async function getDashboardMetrics() {
  const supabase = createClient();

  if (!supabase) {
    return {
      kpis: {
        revenue: 67000,
        activeProjects: 16,
        pendingApprovals: 7,
        signedDocuments: 43,
      },
      series: dashboardSeries,
      activity: activityFeed,
    };
  }

  const [projectRes, approvalRes, docRes] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("signatures").select("id", { count: "exact", head: true }),
  ]);

  return {
    kpis: {
      revenue: 67000,
      activeProjects: projectRes.count ?? 0,
      pendingApprovals: approvalRes.count ?? 0,
      signedDocuments: docRes.count ?? 0,
    },
    series: dashboardSeries,
    activity: activityFeed,
  };
}
