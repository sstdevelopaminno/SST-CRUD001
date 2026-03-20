import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/server";
import { getDictionaryByPath } from "@/lib/i18n/get-dictionary";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getDashboardMetrics } from "@/services/dashboard.service";

export default async function DashboardPage({ params }: { params: { locale: string } }) {
  const { locale, dictionary } = await getDictionaryByPath(params.locale);
  const user = await requireUser(locale);
  const data = await getDashboardMetrics(user);

  const dashboardLabels = dictionary.dashboard as Record<string, string>;
  const isSalesMode = data.mode === "sales";

  const title = isSalesMode
    ? dashboardLabels.salesTitle ?? (locale === "th" ? "แดชบอร์ดฝ่ายขาย" : "Sales Dashboard")
    : dictionary.dashboard.title;

  const revenueLabel = isSalesMode
    ? dashboardLabels.salesRevenue ?? (locale === "th" ? "ยอดขายที่ทำได้" : "Sales Achieved")
    : dictionary.dashboard.revenue;

  const commissionLabel =
    dashboardLabels.commission ?? (locale === "th" ? "ค่าคอมมิชชั่น" : "Commission");

  const chartTitle = isSalesMode
    ? dashboardLabels.salesTrend ?? (locale === "th" ? "แนวโน้มยอดขายของฉัน" : "My Sales Trend")
    : dashboardLabels.revenueTrend ?? "Revenue Trend";

  const activityBadge = dashboardLabels.activityBadge ?? "activity";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className={`grid gap-4 md:grid-cols-2 ${isSalesMode ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{revenueLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(data.kpis.revenue, locale)}</p>
          </CardContent>
        </Card>

        {isSalesMode ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{commissionLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCurrency(data.kpis.commission, locale)}</p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{dictionary.dashboard.pendingApprovals}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.kpis.pendingApprovals}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{dictionary.dashboard.signedDocuments}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.kpis.signedDocuments}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{dictionary.dashboard.activeProjects}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.kpis.activeProjects}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{chartTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={data.series} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{dictionary.dashboard.activity}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.activity.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium">{item.actor}</p>
                  <Badge variant="secondary">{activityBadge}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.action}</p>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(item.at, locale)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
