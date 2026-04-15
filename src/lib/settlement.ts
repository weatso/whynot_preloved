import { supabase } from "./supabase";
import { formatRupiah } from "./skuGenerator";

export interface VendorSettlement {
  vendor_id: string;
  vendor_name: string;
  commission_rate: number;
  items_sold: number;
  gross_revenue: number;
  vendor_payout: number;
  vynalee_margin: number;
}

export interface SettlementReport {
  event_date: string;
  total_gross: number;
  total_payout: number;
  total_margin: number;
  vendors: VendorSettlement[];
  generated_at: string;
}

export async function generateSettlementReport(date?: string): Promise<SettlementReport> {
  const targetDate = date || new Date().toISOString().split("T")[0];
  const startISO = `${targetDate}T00:00:00.000Z`;
  const endISO = `${targetDate}T23:59:59.999Z`;

  // Fetch all completed transactions in the date range
  const { data: txnItems } = await supabase
    .from("transaction_items")
    .select(`
      price_at_sale,
      items ( vendor_id, vendors ( id, name, commission_rate_percentage ) ),
      transactions!inner ( created_at, status )
    `)
    .eq("transactions.status", "completed")
    .gte("transactions.created_at", startISO)
    .lte("transactions.created_at", endISO);

  if (!txnItems) return emptyReport(targetDate);

  const vendorMap = new Map<string, VendorSettlement>();

  for (const row of txnItems) {
    const item = Array.isArray(row.items) ? row.items[0] : row.items;
    if (!item) continue;

    const vendor = Array.isArray(item.vendors) ? item.vendors[0] : item.vendors;
    const vendorId = item.vendor_id || "vynalee";
    const vendorName = vendor?.name || "Vynalee (Barang Sendiri)";
    const commissionRate = vendor?.commission_rate_percentage ?? 0;
    const salePrice = row.price_at_sale || 0;

    const vynalee_margin = salePrice * (commissionRate / 100);
    const vendor_payout = salePrice - vynalee_margin;

    if (!vendorMap.has(vendorId)) {
      vendorMap.set(vendorId, {
        vendor_id: vendorId,
        vendor_name: vendorName,
        commission_rate: commissionRate,
        items_sold: 0,
        gross_revenue: 0,
        vendor_payout: 0,
        vynalee_margin: 0,
      });
    }

    const entry = vendorMap.get(vendorId)!;
    entry.items_sold++;
    entry.gross_revenue += salePrice;
    entry.vendor_payout += vendor_payout;
    entry.vynalee_margin += vynalee_margin;
  }

  const vendors = Array.from(vendorMap.values());
  const total_gross = vendors.reduce((s, v) => s + v.gross_revenue, 0);
  const total_payout = vendors.reduce((s, v) => s + v.vendor_payout, 0);
  const total_margin = vendors.reduce((s, v) => s + v.vynalee_margin, 0);

  return {
    event_date: targetDate,
    total_gross,
    total_payout,
    total_margin,
    vendors,
    generated_at: new Date().toISOString(),
  };
}

function emptyReport(date: string): SettlementReport {
  return { event_date: date, total_gross: 0, total_payout: 0, total_margin: 0, vendors: [], generated_at: new Date().toISOString() };
}

export function exportSettlementCsv(report: SettlementReport): string {
  const lines = [
    `Vynalee Settlement Report — ${report.event_date}`,
    `Generated: ${new Date(report.generated_at).toLocaleString("id-ID")}`,
    ``,
    `Vendor,Commission Rate,Items Sold,Gross Revenue,Vendor Payout,Vynalee Margin`,
    ...report.vendors.map(v =>
      `"${v.vendor_name}",${v.commission_rate}%,${v.items_sold},"${formatRupiah(v.gross_revenue)}","${formatRupiah(v.vendor_payout)}","${formatRupiah(v.vynalee_margin)}"`
    ),
    ``,
    `TOTAL,,${report.vendors.reduce((s,v)=>s+v.items_sold,0)},"${formatRupiah(report.total_gross)}","${formatRupiah(report.total_payout)}","${formatRupiah(report.total_margin)}"`,
  ];
  return lines.join("\n");
}
