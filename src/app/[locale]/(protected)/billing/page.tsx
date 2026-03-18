import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDictionaryByPath } from "@/lib/i18n/get-dictionary";
import { formatCurrency } from "@/lib/utils";
import { getBillingData } from "@/services/billing.service";

export default async function BillingPage({ params }: { params: { locale: string } }) {
  const { locale, dictionary } = await getDictionaryByPath(params.locale);
  const { invoices, purchaseOrders } = await getBillingData();

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{dictionary.billing.title} - Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{invoice.id}</TableCell>
                  <TableCell>{invoice.customer}</TableCell>
                  <TableCell>{formatCurrency(invoice.amount, locale)}</TableCell>
                  <TableCell>
                    <Badge variant={invoice.status.toLowerCase() === "paid" ? "success" : "warning"}>{invoice.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{dictionary.billing.title} - Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell>{po.id}</TableCell>
                  <TableCell>{po.vendor}</TableCell>
                  <TableCell>{formatCurrency(po.amount, locale)}</TableCell>
                  <TableCell>
                    <Badge variant={po.status.toLowerCase().includes("approved") ? "success" : "warning"}>{po.status}</Badge>
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
