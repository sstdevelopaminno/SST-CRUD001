import { createClient } from "@/lib/supabase/server";
import { invoices, purchaseOrders } from "@/services/mock-data";

export async function getBillingData() {
  const supabase = createClient();

  if (!supabase) {
    return { invoices, purchaseOrders };
  }

  const [invoiceRes, poRes] = await Promise.all([
    supabase.from("invoices").select("id, invoice_no, amount, status").order("created_at", { ascending: false }),
    supabase.from("purchase_orders").select("id, po_no, vendor_name, amount, status").order("created_at", { ascending: false }),
  ]);

  if (invoiceRes.error || poRes.error || !invoiceRes.data || !poRes.data) {
    return { invoices, purchaseOrders };
  }

  return {
    invoices: invoiceRes.data.map((item) => ({
      id: item.invoice_no,
      customer: item.id,
      amount: item.amount,
      status: item.status,
    })),
    purchaseOrders: poRes.data.map((item) => ({
      id: item.po_no,
      vendor: item.vendor_name,
      amount: item.amount,
      status: item.status,
    })),
  };
}
