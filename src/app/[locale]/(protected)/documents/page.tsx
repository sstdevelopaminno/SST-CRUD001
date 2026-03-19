import { DocumentsPageClient } from "@/components/documents/documents-page-client";
import { getDictionaryByPath } from "@/lib/i18n/get-dictionary";
import { getDocuments } from "@/services/documents.service";

export default async function DocumentsPage({ params }: { params: { locale: string } }) {
  const { locale, dictionary } = await getDictionaryByPath(params.locale);
  const documents = await getDocuments();
  const documentLabels = dictionary.documents as Record<string, string>;
  const isThai = locale === "th";

  const labels = {
    title: dictionary.documents.title,
    sign: dictionary.documents.sign,
    clear: dictionary.documents.clear,
    titlePlaceholder: documentLabels.titlePlaceholder ?? "Document title",
    uploadButton: documentLabels.uploadButton ?? "Upload",
    tableTitle: documentLabels.tableTitle ?? "Title",
    tableType: documentLabels.tableType ?? "Type",
    tableUploader: documentLabels.tableUploader ?? "Uploader",
    tableSigned: documentLabels.tableSigned ?? "Signed",
    tableActions: documentLabels.tableActions ?? (isThai ? "การทำงาน" : "Actions"),
    previewButton: documentLabels.previewButton ?? (isThai ? "ตัวอย่าง" : "Preview"),
    openButton: documentLabels.openButton ?? (isThai ? "เปิดไฟล์" : "Open"),
    signButton: documentLabels.signButton ?? (isThai ? "ลงนาม" : "Sign"),
    deleteButton: documentLabels.deleteButton ?? (isThai ? "ลบ" : "Delete"),
    closeButton: documentLabels.closeButton ?? (isThai ? "ยกเลิก" : "Cancel"),
    previewModalTitle: documentLabels.previewModalTitle ?? (isThai ? "ตัวอย่างเอกสาร" : "Document Preview"),
    signModalTitle: documentLabels.signModalTitle ?? (isThai ? "ลงนามเอกสาร" : "Sign Document"),
    deleteModalTitle: documentLabels.deleteModalTitle ?? (isThai ? "ยืนยันการลบเอกสาร" : "Delete Document"),
    deleteConfirm: documentLabels.deleteConfirm ?? (isThai ? "ยืนยันการลบเอกสารนี้?" : "Delete this document?"),
    deleteSuccess: documentLabels.deleteSuccess ?? (isThai ? "ลบเอกสารสำเร็จ" : "Document deleted"),
    previewUnsupportedTitle:
      documentLabels.previewUnsupportedTitle ??
      (isThai ? "ไฟล์ประเภทนี้ไม่รองรับการแสดงตัวอย่าง" : "This file type cannot be previewed."),
    previewUnsupportedDescription:
      documentLabels.previewUnsupportedDescription ??
      (isThai ? "คุณยังสามารถเปิดไฟล์จากปุ่มเปิดไฟล์ได้" : "You can still open the file in a new tab."),
    previewOpenHint: documentLabels.previewOpenHint ?? (isThai ? "ใช้ปุ่มเปิดไฟล์เพื่อดูเอกสารฉบับเต็ม" : "Use Open to view the full file."),
    previewNotReady: documentLabels.previewNotReady ?? (isThai ? "ยังไม่สามารถเปิดไฟล์นี้ได้" : "File link is not ready"),
    yes: documentLabels.yes ?? "Yes",
    no: documentLabels.no ?? "No",
    selectFileError: documentLabels.selectFileError ?? "Please select file",
    uploadSuccess: documentLabels.uploadSuccess ?? "Document uploaded",
    selectDocumentError: documentLabels.selectDocumentError ?? "Please choose document",
    signSuccess: documentLabels.signSuccess ?? "Signature saved",
    previewTitle: documentLabels.previewTitle ?? "Document preview",
  };

  return <DocumentsPageClient documents={documents} labels={labels} />;
}
