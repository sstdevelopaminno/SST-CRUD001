import { ApiConfigForm } from "@/components/it-panel/api-config-form";
import { FeatureFlagList } from "@/components/it-panel/feature-flag-list";
import { PermissionOverrideForm } from "@/components/it-panel/permission-override-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDictionaryByPath } from "@/lib/i18n/get-dictionary";
import { getApiConfigs } from "@/services/api-config.service";
import { getFeatureFlags } from "@/services/feature-flag.service";

export default async function ItPanelPage({ params }: { params: { locale: string } }) {
  const { dictionary } = await getDictionaryByPath(params.locale);
  const [flags, apis] = await Promise.all([getFeatureFlags(), getApiConfigs()]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{dictionary.itPanel.title}</h1>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{dictionary.itPanel.featureFlags}</CardTitle>
          </CardHeader>
          <CardContent>
            <FeatureFlagList flags={flags} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{dictionary.itPanel.apiConfigs}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApiConfigForm />
            <PermissionOverrideForm />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Base URL</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apis.map((api) => (
                  <TableRow key={api.id}>
                    <TableCell>{api.name}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{api.base_url}</TableCell>
                    <TableCell>
                      <Badge variant={api.is_active ? "success" : "warning"}>{api.is_active ? "active" : "inactive"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{dictionary.itPanel.logs}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">API Gateway</p>
            <p className="text-lg font-semibold">Healthy</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Queue Lag</p>
            <p className="text-lg font-semibold">24 sec</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Failed Jobs (24h)</p>
            <p className="text-lg font-semibold">3</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
