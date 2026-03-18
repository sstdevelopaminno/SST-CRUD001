import { CrmPageClient } from "@/components/shared/crm-page-client";
import { getDictionaryByPath } from "@/lib/i18n/get-dictionary";
import { getCustomers } from "@/services/crm.service";

export default async function CrmPage({ params }: { params: { locale: string } }) {
  const { dictionary } = await getDictionaryByPath(params.locale);
  const customers = await getCustomers();

  return <CrmPageClient title={dictionary.crm.title} initialRows={customers} />;
}
