import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getDictionaryByPath } from "@/lib/i18n/get-dictionary";
import { getDashboardMetrics } from "@/services/dashboard.service";

export default async function DashboardPage({ params }: { params: { locale: string } }) {
  const { locale, dictionary } = await getDictionaryByPath(params.locale);
  const data = await getDashboardMetrics();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{dictionary.dashboard.title}</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{dictionary.dashboard.revenue}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(data.kpis.revenue, locale)}</p>
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
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
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
                  <Badge variant="secondary">activity</Badge>
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
