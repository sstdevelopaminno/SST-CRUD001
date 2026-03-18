import { DocumentsPageClient } from "@/components/documents/documents-page-client";
import { getDictionaryByPath } from "@/lib/i18n/get-dictionary";
import { getDocuments } from "@/services/documents.service";

export default async function DocumentsPage({ params }: { params: { locale: string } }) {
  const { dictionary } = await getDictionaryByPath(params.locale);
  const documents = await getDocuments();

  return (
    <DocumentsPageClient
      title={dictionary.documents.title}
      documents={documents}
      signLabel={dictionary.documents.sign}
      clearLabel={dictionary.documents.clear}
    />
  );
}
