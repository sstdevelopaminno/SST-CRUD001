"use client";

import * as React from "react";

import { useRef } from "react";
import Papa from "papaparse";

import { Button } from "@/components/ui/button";

interface ImportExportControlsProps {
  filename: string;
  rows: Record<string, unknown>[];
  onImport: (rows: Record<string, unknown>[]) => void;
}

export function ImportExportControls({ filename, rows, onImport }: ImportExportControlsProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function exportJson() {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.json`;
    link.click();
  }

  function exportCsv() {
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        onImport(result.data);
      },
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={exportCsv} data-audit-action="export-csv" data-audit-type="import-export">
        Export CSV
      </Button>
      <Button variant="outline" onClick={exportJson} data-audit-action="export-json" data-audit-type="import-export">
        Export JSON
      </Button>
      <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-audit-action="import-csv" data-audit-type="import-export">
        Import CSV
      </Button>
      <input ref={fileInputRef} type="file" className="hidden" accept=".csv" onChange={onFileChange} />
    </div>
  );
}

