import { createClient } from "@/lib/supabase/server";
import { invoices, purchaseOrders } from "@/services/mock-data";

const DEFAULT_LIMIT = 100;

export async function getBillingData(limit = DEFAULT_LIMIT) {
  const supabase = createClient();

  if (!supabase) {
    return { invoices: invoices.slice(0, limit), purchaseOrders: purchaseOrders.slice(0, limit) };
  }

  const safeLimit = Math.min(Math.max(limit, 1), 200);

  const [invoiceRes, poRes] = await Promise.all([
    supabase.from("invoices").select("id, invoice_no, amount, status").order("created_at", { ascending: false }).limit(safeLimit),
    supabase.from("purchase_orders").select("id, po_no, vendor_name, amount, status").order("created_at", { ascending: false }).limit(safeLimit),
  ]);

  if (invoiceRes.error || poRes.error || !invoiceRes.data || !poRes.data) {
    return { invoices: invoices.slice(0, safeLimit), purchaseOrders: purchaseOrders.slice(0, safeLimit) };
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
