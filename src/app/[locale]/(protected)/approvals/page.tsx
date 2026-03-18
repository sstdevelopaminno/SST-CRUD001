import { ApprovalsClient } from "@/components/shared/approvals-client";
import { requireUser } from "@/lib/auth/server";
import { getDictionaryByPath } from "@/lib/i18n/get-dictionary";
import { getApprovals } from "@/services/approvals.service";

export default async function ApprovalsPage({ params }: { params: { locale: string } }) {
  const { locale, dictionary } = await getDictionaryByPath(params.locale);
  const user = await requireUser(locale);
  const approvals = await getApprovals();

  return (
    <ApprovalsClient
      title={dictionary.approvals.title}
      approveLabel={dictionary.approvals.approve}
      rejectLabel={dictionary.approvals.reject}
      overrideLabel={dictionary.approvals.override}
      isCeo={user.role === "CEO"}
      items={approvals}
    />
  );
}
