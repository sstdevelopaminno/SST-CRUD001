import { redirect } from "next/navigation";

import { SalesTeamClient } from "@/components/sales-team/sales-team-client";
import { requireUser } from "@/lib/auth/server";
import { getDictionaryByPath } from "@/lib/i18n/get-dictionary";
import { hasPermission } from "@/lib/rbac";
import {
  getSalesCommissionCyclesPage,
  getSalesProfileOptions,
  getSalesProfilesPage,
  getSalesTeamMetaOptions,
} from "@/services/sales-team.service";

export default async function SalesTeamPage({ params }: { params: { locale: string } }) {
  const { locale } = await getDictionaryByPath(params.locale);
  const user = await requireUser(locale);

  if (!hasPermission(user.role, "sales:view")) {
    redirect(`/${locale}/dashboard`);
  }

  const [initialProfilePage, initialCyclePage, profileOptions, metaData] = await Promise.all([
    getSalesProfilesPage({ pageSize: 10 }),
    getSalesCommissionCyclesPage({ pageSize: 10 }),
    getSalesProfileOptions(500),
    getSalesTeamMetaOptions(),
  ]);

  return (
    <SalesTeamClient
      initialProfilePage={initialProfilePage}
      initialCyclePage={initialCyclePage}
      profileOptions={profileOptions}
      staffUsers={metaData.staffUsers}
      managers={metaData.managers}
      locale={locale}
    />
  );
}
