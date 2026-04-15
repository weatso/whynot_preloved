"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";

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

    // Tarik semua transaksi beserta item dan data vendornya
    const { data: txns, error } = await supabase
      .from("transactions")
      .select(`
        id, total_amount, discount_applied, payment_method,
        transaction_items (
          price_at_sale, discount_applied, discount_bearer,
          items ( vendor_id, price, vendors ( id, name, commission_rate_percentage ) )
        )
      `)
      .eq("event_id", selectedEventId)
      .eq("status", "completed");

    if (error || !txns) {
      alert("Gagal menarik data");
      setLoading(false);
      return;
    }

    let gross = 0;
    let totalDiscount = 0;
    let cashVolume = 0;
    let qrisVolume = 0;
    let vendorMap: Record<string, { name: string; gross_sales: number; commission_cut: number; net_payout: number; items_sold: number }> = {};

    txns.forEach((txn: any) => {
      gross += Number(txn.total_amount);
      totalDiscount += Number(txn.discount_applied);
      if (txn.payment_method === "CASH") cashVolume += Number(txn.total_amount);
      else qrisVolume += Number(txn.total_amount);

      txn.transaction_items.forEach((ti: any) => {
        const item = ti.items;
        const vendor = item.vendors;
        if (!vendor) return; // Barang Vynalee sendiri atau tidak ada vendor

        const vendorId = vendor.id;
        const salePrice = Number(ti.price_at_sale);
        
        // Asumsi MVP: Komisi dipotong dari harga jual akhir
        const commissionRate = Number(vendor.commission_rate_percentage) / 100;
        const commissionCut = salePrice * commissionRate;
        const netPayout = salePrice - commissionCut;

        if (!vendorMap[vendorId]) {
          vendorMap[vendorId] = { name: vendor.name, gross_sales: 0, commission_cut: 0, net_payout: 0, items_sold: 0 };
        }
        
        vendorMap[vendorId].gross_sales += salePrice;
        vendorMap[vendorId].commission_cut += commissionCut;
        vendorMap[vendorId].net_payout += netPayout;
        vendorMap[vendorId].items_sold += 1;
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
    <div style={{ padding: "2rem", background: "var(--color-brand-bg)", minHeight: "100vh", color: "white" }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>Settlement & Rekonsiliasi</h1>
        <button onClick={() => router.push("/owner")} style={{ padding: "0.5rem 1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", cursor: "pointer" }}>← Dashboard</button>
      </div>

      <div className="no-print" style={{ background: "var(--color-brand-card)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-brand-border)", marginBottom: "2rem", display: "flex", gap: "1rem" }}>
        <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} style={{ flex: 1, padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none", fontSize: "1.1rem" }}>
          <option value="" disabled>-- Pilih Event untuk di-Settle --</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} {ev.is_closed ? "(CLOSED)" : "(ACTIVE)"}</option>)}
        </select>
        <button onClick={generateReport} disabled={loading} style={{ padding: "1rem 2rem", background: "var(--color-brand-accent)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "1.1rem" }}>
          {loading ? "Menghitung..." : "Generate Laporan"}
        </button>
        {summary && <button onClick={() => window.print()} style={{ padding: "1rem 2rem", background: "var(--color-brand-green)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "1.1rem" }}>🖨️ Cetak</button>}
      </div>

      {summary && (
        <div id="printable-area">
          <div style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.5rem", color: "var(--color-brand-accent-light)", marginBottom: "1rem" }}>Ringkasan Eksekutif</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
              <div style={{ background: "var(--color-brand-surface)", padding: "1.5rem", borderRadius: "12px", border: "1px solid var(--color-brand-border)" }}>
                <p style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem", textTransform: "uppercase" }}>Total Uang Masuk (Gross)</p>
                <h3 style={{ fontSize: "2rem", color: "white" }}>Rp {summary.gross.toLocaleString("id-ID")}</h3>
                <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--color-brand-muted)" }}>
                  <span>CASH: Rp {summary.cashVolume.toLocaleString("id-ID")}</span>
                  <span>QRIS: Rp {summary.qrisVolume.toLocaleString("id-ID")}</span>
                </div>
              </div>
              <div style={{ background: "rgba(16, 185, 129, 0.1)", padding: "1.5rem", borderRadius: "12px", border: "1px solid var(--color-brand-green)" }}>
                <p style={{ color: "var(--color-brand-green)", fontSize: "0.85rem", textTransform: "uppercase" }}>Pendapatan Bersih Vynalee</p>
                <h3 style={{ fontSize: "2rem", color: "var(--color-brand-green)" }}>Rp {summary.vynaleeNetRevenue.toLocaleString("id-ID")}</h3>
              </div>
              <div style={{ background: "rgba(245, 158, 11, 0.1)", padding: "1.5rem", borderRadius: "12px", border: "1px solid var(--color-brand-yellow)" }}>
                <p style={{ color: "var(--color-brand-yellow)", fontSize: "0.85rem", textTransform: "uppercase" }}>Total Hutang ke Vendor</p>
                <h3 style={{ fontSize: "2rem", color: "var(--color-brand-yellow)" }}>Rp {summary.totalVendorPayout.toLocaleString("id-ID")}</h3>
              </div>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: "1.5rem", color: "var(--color-brand-accent-light)", marginBottom: "1rem" }}>Daftar Payout Vendor (Konsinyasi)</h2>
            <div style={{ background: "var(--color-brand-surface)", borderRadius: "12px", border: "1px solid var(--color-brand-border)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "var(--color-brand-border)", color: "var(--color-brand-muted)", textTransform: "uppercase", fontSize: "0.85rem" }}>
                    <th style={{ padding: "1rem" }}>Nama Vendor</th>
                    <th style={{ padding: "1rem" }}>Item Terjual</th>
                    <th style={{ padding: "1rem" }}>Total Penjualan</th>
                    <th style={{ padding: "1rem" }}>Potongan Komisi Vynalee</th>
                    <th style={{ padding: "1rem", color: "white" }}>Transfer ke Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorPayouts.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--color-brand-muted)" }}>Tidak ada data penjualan vendor pada event ini.</td></tr>
                  ) : vendorPayouts.map((v, idx) => (
                    <tr key={idx} style={{ borderTop: "1px solid var(--color-brand-border)" }}>
                      <td style={{ padding: "1rem", fontWeight: "bold" }}>{v.name}</td>
                      <td style={{ padding: "1rem" }}>{v.items_sold} pcs</td>
                      <td style={{ padding: "1rem" }}>Rp {v.gross_sales.toLocaleString("id-ID")}</td>
                      <td style={{ padding: "1rem", color: "var(--color-brand-red)" }}>- Rp {v.commission_cut.toLocaleString("id-ID")}</td>
                      <td style={{ padding: "1rem", color: "var(--color-brand-green)", fontWeight: "bold", fontSize: "1.1rem" }}>Rp {v.net_payout.toLocaleString("id-ID")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .no-print { display: none !important; }
          #printable-area, #printable-area * { visibility: visible; }
          #printable-area { position: absolute; left: 0; top: 0; width: 100%; color: black !important; }
          #printable-area div, #printable-area p, #printable-area h2, #printable-area h3, #printable-area th, #printable-area td { color: black !important; border-color: #ccc !important; }
        }
      `}} />
    </div>
  );
}