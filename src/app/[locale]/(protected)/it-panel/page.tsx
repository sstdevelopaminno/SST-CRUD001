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
      <Card>
        <CardHeader>
          <CardTitle>{dictionary.itPanel.logs}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{dictionary.itPanel.apiGateway}</p>
            <p className="text-lg font-semibold">{dictionary.common.healthy}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{dictionary.itPanel.queueLag}</p>
            <p className="text-lg font-semibold">24 sec</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{dictionary.itPanel.failedJobs24h}</p>
            <p className="text-lg font-semibold">3</p>
          </div>
        </CardContent>
      </Card>

      <h1 className="text-2xl font-semibold">{dictionary.itPanel.title}</h1>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{dictionary.itPanel.featureFlags}</CardTitle>
          </CardHeader>
          <CardContent>
            <FeatureFlagList
              flags={flags}
              labels={{
                featureFlagUpdated: dictionary.itPanel.featureFlagUpdated,
                moduleLabels: dictionary.itPanel.moduleLabels,
                moduleDescriptions: dictionary.itPanel.moduleDescriptions,
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{dictionary.itPanel.apiConfigs}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApiConfigForm
              labels={{
                connectionName: dictionary.itPanel.connectionName,
                baseUrlPlaceholder: dictionary.itPanel.baseUrlPlaceholder,
                apiKeyPlaceholder: dictionary.itPanel.apiKeyPlaceholder,
                testConnection: dictionary.itPanel.testConnection,
                saveApi: dictionary.itPanel.saveApi,
                apiConfigSaved: dictionary.itPanel.apiConfigSaved,
              }}
            />
            <PermissionOverrideForm
              labels={{
                forceOverrideTitle: dictionary.itPanel.forceOverrideTitle,
                targetUserUuid: dictionary.itPanel.targetUserUuid,
                userIdRequired: dictionary.itPanel.userIdRequired,
                applyOverride: dictionary.itPanel.applyOverride,
                permissionOverrideApplied: dictionary.itPanel.permissionOverrideApplied,
              }}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dictionary.itPanel.tableName}</TableHead>
                  <TableHead>{dictionary.itPanel.tableBaseUrl}</TableHead>
                  <TableHead>{dictionary.itPanel.tableStatus}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apis.map((api) => (
                  <TableRow key={api.id}>
                    <TableCell>{api.name}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{api.base_url}</TableCell>
                    <TableCell>
                      <Badge variant={api.is_active ? "success" : "warning"}>
                        {api.is_active ? dictionary.itPanel.statusActive : dictionary.itPanel.statusInactive}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
