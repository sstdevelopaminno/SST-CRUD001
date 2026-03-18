"use client";

import { useMemo, useState } from "react";

import { ImportExportControls } from "@/components/shared/import-export-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
}

export function CrmPageClient({ title, initialRows }: { title: string; initialRows: CustomerRow[] }) {
  const [rows, setRows] = useState<CustomerRow[]>(initialRows);

  const exportRows = useMemo(() => {
    return rows.map((row) => ({ ...row }));
  }, [rows]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <ImportExportControls
            filename="customers-backup"
            rows={exportRows}
            onImport={(data) => {
              const parsed = data.map((item, index) => ({
                id: String(item.id ?? `IMP-${index + 1}`),
                name: String(item.name ?? "Unknown"),
                email: item.email ? String(item.email) : null,
                phone: item.phone ? String(item.phone) : null,
                status: String(item.status ?? "prospect"),
              }));

              setRows(parsed);
            }}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.phone}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "active" ? "success" : "warning"}>{row.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
