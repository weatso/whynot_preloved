"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";

type FilterMode = "event" | "daterange";

export default function SettlementPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [vendorPayouts, setVendorPayouts] = useState<any[]>([]);
  const [reportLabel, setReportLabel] = useState("");

  const [filterMode, setFilterMode] = useState<FilterMode>("event");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!user || user.role !== "owner") router.replace("/login");
    else fetchEvents();
  }, [user, router]);

  const fetchEvents = async () => {
    const { data } = await supabase.from("events").select("id, name, is_closed").order("created_at", { ascending: false });
    if (data) setEvents(data);
  };

  const generateReport = async () => {
    if (filterMode === "event" && !selectedEventId) return alert("Pilih event terlebih dahulu.");
    if (filterMode === "daterange" && (!dateFrom || !dateTo)) return alert("Isi tanggal mulai dan selesai.");
    setLoading(true);
    setSummary(null);

    let query = supabase.from("transactions").select(`
      id, total_amount, discount_applied, payment_method, created_at,
      transaction_items (
        price_at_sale, discount_applied, discount_bearer,
        items ( vendor_id, price, vendors ( id, name, commission_rate_percentage ) )
      )
    `);

    if (filterMode === "event") {
      query = query.eq("event_id", selectedEventId);
      setReportLabel(events.find(e => e.id === selectedEventId)?.name || "Event");
    } else {
      query = query
        .gte("created_at", `${dateFrom}T00:00:00+07:00`)
        .lte("created_at", `${dateTo}T23:59:59+07:00`);
      const fmt = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
      setReportLabel(`${fmt(dateFrom)} – ${fmt(dateTo)}`);
    }

    const { data: txns, error } = await query;
    if (error || !txns) { alert("Gagal menarik data."); setLoading(false); return; }

    let gross = 0, totalDiscount = 0, cashVolume = 0, qrisVolume = 0;
    let vendorMap: Record<string, { name: string; gross_sales: number; commission_cut: number; net_payout: number; items_sold: number }> = {};

    txns.forEach((txn: any) => {
      gross += Number(txn.total_amount);
      totalDiscount += Number(txn.discount_applied);
      if (txn.payment_method === "CASH") cashVolume += Number(txn.total_amount);
      else qrisVolume += Number(txn.total_amount);

      txn.transaction_items.forEach((ti: any) => {
        const item = ti.items;
        const vendor = item?.vendors;
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

    setSummary({ gross, totalDiscount, cashVolume, qrisVolume, totalVendorPayout, vynaleeNetRevenue, txnCount: txns.length });
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

        {/* Filter Controls */}
        <div className="wnp-card no-print" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Mode Pilih */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setFilterMode("event")}
              className="wnp-btn"
              style={{
                flex: 1, fontSize: "0.85rem",
                background: filterMode === "event" ? "var(--color-brand-accent)" : "transparent",
                color: filterMode === "event" ? "white" : "var(--color-brand-muted)",
                border: "1px solid var(--color-brand-border)",
              }}
            >
              📅 Per Event
            </button>
            <button
              onClick={() => setFilterMode("daterange")}
              className="wnp-btn"
              style={{
                flex: 1, fontSize: "0.85rem",
                background: filterMode === "daterange" ? "var(--color-brand-accent)" : "transparent",
                color: filterMode === "daterange" ? "white" : "var(--color-brand-muted)",
                border: "1px solid var(--color-brand-border)",
              }}
            >
              📆 Rentang Tanggal
            </button>
          </div>

          {/* Input sesuai mode */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            {filterMode === "event" ? (
              <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} className="wnp-input" style={{ flex: "1 1 200px" }}>
                <option value="" disabled>— Pilih Event —</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} {ev.is_closed ? "(CLOSED)" : "(ACTIVE)"}</option>)}
              </select>
            ) : (
              <>
                <div style={{ flex: "1 1 140px" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.3rem" }}>Dari Tanggal</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="wnp-input" style={{ colorScheme: "dark" }} />
                </div>
                <div style={{ flex: "1 1 140px" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.3rem" }}>Sampai Tanggal</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} min={dateFrom} className="wnp-input" style={{ colorScheme: "dark" }} />
                </div>
              </>
            )}
            <button onClick={generateReport} disabled={loading} className="wnp-btn wnp-btn-primary" style={{ flexShrink: 0, alignSelf: "flex-end" }}>
              {loading ? "Menghitung..." : "Generate Laporan"}
            </button>
          </div>
        </div>

        {/* Report */}
        {summary && (
          <div id="printable-area">
            <div style={{ marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: "bold" }}>Laporan Settlement</h2>
              <p style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem" }}>
                Periode: <strong style={{ color: "var(--color-brand-accent-light)" }}>{reportLabel}</strong>
                {" "}• {summary.txnCount} transaksi
              </p>
            </div>

            {/* Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ background: "var(--color-brand-surface)", padding: "1.25rem", borderRadius: "12px", border: "1px solid var(--color-brand-border)" }}>
                <p style={{ color: "var(--color-brand-muted)", fontSize: "0.78rem", textTransform: "uppercase", marginBottom: "0.35rem" }}>Total Uang Masuk (Gross)</p>
                <h3 style={{ fontSize: "clamp(1.2rem, 4vw, 1.8rem)", fontWeight: "bold" }}>Rp {summary.gross.toLocaleString("id-ID")}</h3>
                <div style={{ fontSize: "0.78rem", color: "var(--color-brand-muted)", marginTop: "0.3rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <span>CASH: Rp {summary.cashVolume.toLocaleString("id-ID")}</span>
                  <span>QRIS: Rp {summary.qrisVolume.toLocaleString("id-ID")}</span>
                </div>
              </div>
              <div style={{ background: "rgba(16,185,129,0.08)", padding: "1.25rem", borderRadius: "12px", border: "1px solid var(--color-brand-green)" }}>
                <p style={{ color: "var(--color-brand-green)", fontSize: "0.78rem", textTransform: "uppercase", marginBottom: "0.35rem" }}>Pendapatan Bersih Vynalee</p>
                <h3 style={{ fontSize: "clamp(1.2rem, 4vw, 1.8rem)", color: "var(--color-brand-green)", fontWeight: "bold" }}>Rp {summary.vynaleeNetRevenue.toLocaleString("id-ID")}</h3>
              </div>
              <div style={{ background: "rgba(245,158,11,0.08)", padding: "1.25rem", borderRadius: "12px", border: "1px solid var(--color-brand-yellow)" }}>
                <p style={{ color: "var(--color-brand-yellow)", fontSize: "0.78rem", textTransform: "uppercase", marginBottom: "0.35rem" }}>Total Hutang ke Vendor</p>
                <h3 style={{ fontSize: "clamp(1.2rem, 4vw, 1.8rem)", color: "var(--color-brand-yellow)", fontWeight: "bold" }}>Rp {summary.totalVendorPayout.toLocaleString("id-ID")}</h3>
              </div>
            </div>

            {/* Vendor Payout Table */}
            <h2 style={{ fontSize: "1.1rem", fontWeight: "bold", marginBottom: "1rem", color: "var(--color-brand-accent-light)" }}>
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
                    <th style={{ color: "var(--color-brand-green)" }}>Transfer ke Vendor</th>
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
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .no-print { display: none !important; }
          #printable-area, #printable-area * { visibility: visible; }
          #printable-area { position: absolute; left: 0; top: 0; width: 100%; color: black !important; }
          #printable-area * { color: black !important; border-color: #ccc !important; }
        }
        [data-theme="light"] input[type="date"] { color-scheme: light; }
      `}} />
    </div>
  );
}