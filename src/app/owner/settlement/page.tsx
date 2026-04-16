"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";

export default function SettlementPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [vendorPayouts, setVendorPayouts] = useState<any[]>([]);

  useEffect(() => {
    if (!user || user.role !== "owner") router.replace("/login");
    else fetchEvents();
  }, [user, router]);

  const fetchEvents = async () => {
    const { data } = await supabase.from("events").select("id, name, is_closed").order("created_at", { ascending: false });
    if (data) setEvents(data);
  };

  const generateReport = async () => {
    if (!selectedEventId) return alert("Pilih event terlebih dahulu");
    setLoading(true);

    const { data: txns, error } = await supabase
      .from("transactions")
      .select(`
        id, total_amount, discount_applied, payment_method,
        transaction_items (
          price_at_sale, discount_applied, discount_bearer,
          items ( vendor_id, price, vendors ( id, name, commission_rate_percentage ) )
        )
      `)
      .eq("event_id", selectedEventId);

    if (error || !txns) { alert("Gagal menarik data"); setLoading(false); return; }

    let gross = 0, totalDiscount = 0, cashVolume = 0, qrisVolume = 0;
    let vendorMap: Record<string, { name: string; gross_sales: number; commission_cut: number; net_payout: number; items_sold: number }> = {};

    txns.forEach((txn: any) => {
      gross += Number(txn.total_amount);
      totalDiscount += Number(txn.discount_applied);
      if (txn.payment_method === "CASH") cashVolume += Number(txn.total_amount);
      else qrisVolume += Number(txn.total_amount);

      txn.transaction_items.forEach((ti: any) => {
        const item = ti.items;
        const vendor = item.vendors;
        if (!vendor) return;
        const vId = vendor.id;
        const salePrice = Number(ti.price_at_sale);
        const commissionRate = Number(vendor.commission_rate_percentage) / 100;
        const commissionCut = salePrice * commissionRate;
        const netPayout = salePrice - commissionCut;

        if (!vendorMap[vId]) vendorMap[vId] = { name: vendor.name, gross_sales: 0, commission_cut: 0, net_payout: 0, items_sold: 0 };
        vendorMap[vId].gross_sales += salePrice;
        vendorMap[vId].commission_cut += commissionCut;
        vendorMap[vId].net_payout += netPayout;
        vendorMap[vId].items_sold += 1;
      });
    });

    const payoutsArray = Object.values(vendorMap).sort((a, b) => b.net_payout - a.net_payout);
    const totalVendorPayout = payoutsArray.reduce((sum, v) => sum + v.net_payout, 0);
    const vynaleeNetRevenue = gross - totalVendorPayout;

    setSummary({ gross, totalDiscount, cashVolume, qrisVolume, totalVendorPayout, vynaleeNetRevenue });
    setVendorPayouts(payoutsArray);
    setLoading(false);
  };

  if (!user) return null;

  return (
    <div className="wnp-page">
      <PageHeader title="Settlement &amp; Rekonsiliasi">
        {summary && (
          <button onClick={() => window.print()} className="wnp-btn wnp-btn-success no-print">
            🖨️ Cetak
          </button>
        )}
      </PageHeader>

      <div className="wnp-page-content">
        {/* Controls */}
        <div className="wnp-card no-print" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} className="wnp-input" style={{ flex: "1 1 180px" }}>
            <option value="" disabled>-- Pilih Event --</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} {ev.is_closed ? "(CLOSED)" : "(ACTIVE)"}</option>)}
          </select>
          <button onClick={generateReport} disabled={loading} className="wnp-btn wnp-btn-primary" style={{ flexShrink: 0 }}>
            {loading ? "Menghitung..." : "Generate Laporan"}
          </button>
        </div>

        {/* Report */}
        {summary && (
          <div id="printable-area">
            {/* Summary Cards */}
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.2rem", color: "var(--color-brand-accent-light)", marginBottom: "1rem", fontWeight: "bold" }}>
                Ringkasan Eksekutif
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                <div style={{ background: "var(--color-brand-surface)", padding: "1.25rem", borderRadius: "12px", border: "1px solid var(--color-brand-border)" }}>
                  <p style={{ color: "var(--color-brand-muted)", fontSize: "0.8rem", textTransform: "uppercase" }}>Total Uang Masuk (Gross)</p>
                  <h3 style={{ fontSize: "clamp(1.3rem, 4vw, 2rem)", color: "var(--color-brand-text)", fontWeight: "bold" }}>
                    Rp {summary.gross.toLocaleString("id-ID")}
                  </h3>
                  <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.4rem", fontSize: "0.8rem", color: "var(--color-brand-muted)", flexWrap: "wrap" }}>
                    <span>CASH: Rp {summary.cashVolume.toLocaleString("id-ID")}</span>
                    <span>QRIS: Rp {summary.qrisVolume.toLocaleString("id-ID")}</span>
                  </div>
                </div>

                <div style={{ background: "rgba(16, 185, 129, 0.08)", padding: "1.25rem", borderRadius: "12px", border: "1px solid var(--color-brand-green)" }}>
                  <p style={{ color: "var(--color-brand-green)", fontSize: "0.8rem", textTransform: "uppercase" }}>Pendapatan Bersih Vynalee</p>
                  <h3 style={{ fontSize: "clamp(1.3rem, 4vw, 2rem)", color: "var(--color-brand-green)", fontWeight: "bold" }}>
                    Rp {summary.vynaleeNetRevenue.toLocaleString("id-ID")}
                  </h3>
                </div>

                <div style={{ background: "rgba(245, 158, 11, 0.08)", padding: "1.25rem", borderRadius: "12px", border: "1px solid var(--color-brand-yellow)" }}>
                  <p style={{ color: "var(--color-brand-yellow)", fontSize: "0.8rem", textTransform: "uppercase" }}>Total Hutang ke Vendor</p>
                  <h3 style={{ fontSize: "clamp(1.3rem, 4vw, 2rem)", color: "var(--color-brand-yellow)", fontWeight: "bold" }}>
                    Rp {summary.totalVendorPayout.toLocaleString("id-ID")}
                  </h3>
                </div>
              </div>
            </div>

            {/* Vendor Payout Table */}
            <div>
              <h2 style={{ fontSize: "1.2rem", color: "var(--color-brand-accent-light)", marginBottom: "1rem", fontWeight: "bold" }}>
                Daftar Payout Vendor (Konsinyasi)
              </h2>
              <div className="wnp-table-wrapper">
                <table className="wnp-table">
                  <thead>
                    <tr>
                      <th>Nama Vendor</th>
                      <th>Item Terjual</th>
                      <th>Total Penjualan</th>
                      <th>Komisi Vynalee</th>
                      <th>Transfer ke Vendor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorPayouts.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--color-brand-muted)" }}>Tidak ada data penjualan vendor.</td></tr>
                    ) : vendorPayouts.map((v, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: "bold" }}>{v.name}</td>
                        <td>{v.items_sold} pcs</td>
                        <td>Rp {v.gross_sales.toLocaleString("id-ID")}</td>
                        <td style={{ color: "var(--color-brand-red)" }}>- Rp {Math.round(v.commission_cut).toLocaleString("id-ID")}</td>
                        <td style={{ color: "var(--color-brand-green)", fontWeight: "bold" }}>Rp {Math.round(v.net_payout).toLocaleString("id-ID")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .no-print { display: none !important; }
          #printable-area, #printable-area * { visibility: visible; }
          #printable-area { position: absolute; left: 0; top: 0; width: 100%; color: black !important; }
          #printable-area div, #printable-area p, #printable-area h2, #printable-area h3,
          #printable-area th, #printable-area td, #printable-area span {
            color: black !important; border-color: #ccc !important;
          }
        }
      `}} />
    </div>
  );
}