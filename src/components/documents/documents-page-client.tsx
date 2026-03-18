"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveSignatureAction, uploadDocumentAction } from "@/app/actions/documents";
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
}

export function DocumentsPageClient({
  title,
  documents,
  signLabel,
  clearLabel,
}: {
  title: string;
  documents: DocumentRow[];
  signLabel: string;
  clearLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>(documents[0]?.id ?? "");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  function upload() {
    if (!uploadFile) {
      toast.error("Please select file");
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

      toast.success("Document uploaded");
      setUploadFile(null);
      setUploadTitle("");
    });
  }

  function saveSignature(dataUrl: string) {
    if (!selectedDocumentId) {
      toast.error("Please choose document");
      return;
    }

    startTransition(async () => {
      const result = await saveSignatureAction({
        document_id: selectedDocumentId,
        signature_data_url: dataUrl,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Signature saved");
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} placeholder="Document title" />
            <Input type="file" accept="application/pdf" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
            <Button onClick={upload} disabled={pending} data-audit-action="upload-document" data-audit-type="documents">
              Upload
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Uploader</TableHead>
                <TableHead>Signed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((item) => (
                <TableRow key={item.id} onClick={() => setSelectedDocumentId(item.id)} className="cursor-pointer">
                  <TableCell>{item.title}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.uploader}</TableCell>
                  <TableCell>{item.signed ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="overflow-hidden rounded-lg border">
            <iframe title="PDF Preview" src="about:blank" className="h-[360px] w-full bg-muted" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{signLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <SignaturePad onSave={saveSignature} clearLabel={clearLabel} signLabel={signLabel} />
        </CardContent>
      </Card>
    </div>
  );
}
