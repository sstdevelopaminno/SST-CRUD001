import { ProjectCommissionSettings, SalesProjectWorkspace } from "@/components/projects/project-commission-settings";
import { requireUser } from "@/lib/auth/server";
import { getDictionaryByPath } from "@/lib/i18n/get-dictionary";
import {
  getProjectCasesPage,
  getProjectTemplatesPage,
  getProjectTransfersPage,
  getSalesProjectWorkspaceData,
  getTransferApprovalQueueData,
} from "@/services/projects.service";

export default async function ProjectsPage({ params }: { params: { locale: string } }) {
  const { locale } = await getDictionaryByPath(params.locale);
  const user = await requireUser(locale);
  const canReviewTransfers = user.role === "CEO" || user.role === "MANAGER" || user.role === "HEAD";

  const [managementPageData, workspace, reviewQueue] = await Promise.all([
    user.role === "CEO"
      ? Promise.all([
          getProjectTemplatesPage({ pageSize: 10 }),
          getProjectCasesPage({ pageSize: 10 }),
          getProjectTransfersPage({ pageSize: 10 }),
        ])
      : Promise.resolve(null),
    user.role !== "CEO" ? getSalesProjectWorkspaceData(user.id) : Promise.resolve(null),
    canReviewTransfers && user.role !== "CEO" ? getTransferApprovalQueueData() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-4">
      {user.role === "CEO" && managementPageData ? (
        <ProjectCommissionSettings
          initialProjectsPage={managementPageData[0]}
          initialCasesPage={managementPageData[1]}
          initialPendingTransfersPage={managementPageData[2]}
          locale={locale}
        />
      ) : null}

      {user.role !== "CEO" && workspace ? (
        <SalesProjectWorkspace
          templates={workspace.templates}
          myCases={workspace.myCases}
          myTransfers={workspace.myTransfers}
          transferTargets={workspace.transferTargets}
          reviewQueue={reviewQueue}
          canReviewTransfers={canReviewTransfers}
          allowCaseCreate={user.role === "STAFF"}
          locale={locale}
        />
      ) : null}
    </div>
  );
}


