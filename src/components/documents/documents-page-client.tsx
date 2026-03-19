"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ExternalLink, Eye, PenSquare, Trash2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";

import { deleteDocumentAction, saveSignatureAction, uploadDocumentAction } from "@/app/actions/documents";
import { SignaturePad } from "@/components/documents/signature-pad";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DocumentRow {
  id: string;
  title: string;
  type: string;
  signed: boolean;
  uploader: string;
  preview_url?: string | null;
}

interface DocumentsLabels {
  title: string;
  sign: string;
  clear: string;
  titlePlaceholder: string;
  uploadButton: string;
  tableTitle: string;
  tableType: string;
  tableUploader: string;
  tableSigned: string;
  tableActions: string;
  previewButton: string;
  openButton: string;
  signButton: string;
  deleteButton: string;
  closeButton: string;
  previewModalTitle: string;
  signModalTitle: string;
  deleteModalTitle: string;
  deleteConfirm: string;
  deleteSuccess: string;
  previewUnsupportedTitle: string;
  previewUnsupportedDescription: string;
  previewOpenHint: string;
  previewNotReady: string;
  yes: string;
  no: string;
  selectFileError: string;
  uploadSuccess: string;
  selectDocumentError: string;
  signSuccess: string;
  previewTitle: string;
}

const MODAL_ANIMATION_MS = 260;

function isPreviewableType(fileType: string) {
  const normalized = fileType.toLowerCase();
  return normalized.includes("pdf") || normalized.startsWith("image/");
}

export function DocumentsPageClient({ documents, labels }: { documents: DocumentRow[]; labels: DocumentsLabels }) {
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(documents);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [previewTarget, setPreviewTarget] = useState<DocumentRow | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [signTarget, setSignTarget] = useState<DocumentRow | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCloseTimerRef = useRef<number | null>(null);
  const signCloseTimerRef = useRef<number | null>(null);
  const deleteCloseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (previewCloseTimerRef.current) {
        clearTimeout(previewCloseTimerRef.current);
      }
      if (signCloseTimerRef.current) {
        clearTimeout(signCloseTimerRef.current);
      }
      if (deleteCloseTimerRef.current) {
        clearTimeout(deleteCloseTimerRef.current);
      }
    };
  }, []);

  function openDocument(url: string | null | undefined) {
    if (!url) {
      toast.error(labels.previewNotReady);
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openPreviewModal(target: DocumentRow) {
    if (previewCloseTimerRef.current) {
      clearTimeout(previewCloseTimerRef.current);
    }

    setPreviewTarget(target);
    requestAnimationFrame(() => setPreviewOpen(true));
  }

  function closePreviewModal() {
    setPreviewOpen(false);
    previewCloseTimerRef.current = window.setTimeout(() => setPreviewTarget(null), MODAL_ANIMATION_MS);
  }

  function openSignModal(target: DocumentRow) {
    if (signCloseTimerRef.current) {
      clearTimeout(signCloseTimerRef.current);
    }

    setSignTarget(target);
    requestAnimationFrame(() => setSignOpen(true));
  }

  function closeSignModal() {
    setSignOpen(false);
    signCloseTimerRef.current = window.setTimeout(() => setSignTarget(null), MODAL_ANIMATION_MS);
  }

  function openDeleteModal(target: DocumentRow) {
    if (deleteCloseTimerRef.current) {
      clearTimeout(deleteCloseTimerRef.current);
    }

    setDeleteTarget(target);
    requestAnimationFrame(() => setDeleteOpen(true));
  }

  function closeDeleteModal() {
    setDeleteOpen(false);
    deleteCloseTimerRef.current = window.setTimeout(() => setDeleteTarget(null), MODAL_ANIMATION_MS);
  }

  function upload() {
    if (!uploadFile) {
      toast.error(labels.selectFileError);
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", uploadTitle || uploadFile.name);
      formData.set("file", uploadFile);

      const result = await uploadDocumentAction(formData);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      if (result.document) {
        setRows((previousRows) => [result.document, ...previousRows]);
      }

      toast.success(labels.uploadSuccess);
      setUploadFile(null);
      setUploadTitle("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    });
  }

  function confirmDeleteDocument() {
    if (!deleteTarget) {
      return;
    }

    const target = deleteTarget;

    startTransition(async () => {
      const result = await deleteDocumentAction({ document_id: target.id });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setRows((previousRows) => previousRows.filter((item) => item.id !== target.id));
      closeDeleteModal();
      toast.success(labels.deleteSuccess);
    });
  }

  function saveSignatureForDocument(documentId: string, dataUrl: string) {
    startTransition(async () => {
      const result = await saveSignatureAction({
        document_id: documentId,
        signature_data_url: dataUrl,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setRows((previousRows) => previousRows.map((item) => (item.id === documentId ? { ...item, signed: true } : item)));
      closeSignModal();
      toast.success(labels.signSuccess);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{labels.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} placeholder={labels.titlePlaceholder} />
            <Input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            />
            <Button onClick={upload} disabled={pending} data-audit-action="upload-document" data-audit-type="documents">
              {labels.uploadButton}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{labels.tableTitle}</TableHead>
                <TableHead>{labels.tableType}</TableHead>
                <TableHead>{labels.tableUploader}</TableHead>
                <TableHead>{labels.tableSigned}</TableHead>
                <TableHead>{labels.tableActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.title}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.uploader}</TableCell>
                  <TableCell>{item.signed ? labels.yes : labels.no}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openPreviewModal(item)} disabled={pending}>
                        <Eye className="mr-1 h-4 w-4" />
                        {labels.previewButton}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openDocument(item.preview_url)} disabled={pending || !item.preview_url}>
                        <ExternalLink className="mr-1 h-4 w-4" />
                        {labels.openButton}
                      </Button>
                      <Button size="sm" onClick={() => openSignModal(item)} disabled={pending}>
                        <PenSquare className="mr-1 h-4 w-4" />
                        {labels.signButton}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => openDeleteModal(item)} disabled={pending}>
                        <Trash2 className="mr-1 h-4 w-4" />
                        {labels.deleteButton}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {previewTarget ? (
        <div
          className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 transition-opacity duration-200 ${
            previewOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={closePreviewModal}
        >
          <div
            className={`w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl transform-gpu transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              previewOpen ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b pb-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{labels.previewModalTitle}</h3>
                <p className="text-sm text-slate-600">{previewTarget.title}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={closePreviewModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border bg-muted/30">
              {isPreviewableType(previewTarget.type) && previewTarget.preview_url ? (
                <iframe title={labels.previewTitle} src={previewTarget.preview_url} className="h-[70vh] w-full bg-muted" />
              ) : (
                <div className="flex h-[70vh] items-center justify-center text-center text-sm text-muted-foreground">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{labels.previewUnsupportedTitle}</p>
                      <p>{labels.previewUnsupportedDescription}</p>
                      <p>{labels.previewOpenHint}</p>
                    </div>
                    <div>
                      <Button variant="outline" onClick={() => openDocument(previewTarget.preview_url)} disabled={!previewTarget.preview_url}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {labels.openButton}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {signTarget ? (
        <div
          className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 transition-opacity duration-200 ${
            signOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={closeSignModal}
        >
          <div
            className={`w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transform-gpu transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              signOpen ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b pb-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{labels.signModalTitle}</h3>
                <p className="text-sm text-slate-600">{signTarget.title}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeSignModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4">
              <SignaturePad onSave={(dataUrl) => saveSignatureForDocument(signTarget.id, dataUrl)} clearLabel={labels.clear} signLabel={labels.sign} />
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className={`fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 transition-opacity duration-200 ${
            deleteOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={closeDeleteModal}
        >
          <div
            className={`w-full max-w-md rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 shadow-2xl transform-gpu transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              deleteOpen ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-rose-100 p-2 text-rose-600">
                <TriangleAlert className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-900">{labels.deleteModalTitle}</h4>
                <p className="mt-1 text-sm text-slate-600">
                  {labels.deleteConfirm} <span className="font-semibold text-slate-800">{deleteTarget.title}</span>
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={closeDeleteModal} disabled={pending}>
                {labels.closeButton}
              </Button>
              <Button variant="destructive" onClick={confirmDeleteDocument} disabled={pending}>
                <Trash2 className="mr-2 h-4 w-4" />
                {labels.deleteButton}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
