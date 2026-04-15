"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { generateSettlementReport, exportSettlementCsv } from "@/lib/settlement";
import { formatRupiah } from "@/lib/skuGenerator";
import type { SettlementReport } from "@/lib/settlement";

export default function SettlementPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [report, setReport] = useState<SettlementReport|null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!user) router.replace("/login"); else if (user.role !== "owner") router.replace("/kasir"); }, [user, router]);

  const handleGenerate = async () => {
    setLoading(true);
    const r = await generateSettlementReport(date);
    setReport(r);
    setLoading(false);
  };

  const handleExportCsv = () => {
    if (!report) return;
    const csv = exportSettlementCsv(report);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `settlement-vynalee-${date}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!user || user.role !== "owner") return null;

  return (
    <>
      <style>{`@media print { .no-print { display:none !important; } }`}</style>
      <div style={{ minHeight:"100vh", background:"var(--color-brand-bg)", fontFamily:"var(--font-display)" }}>
        <header className="no-print" style={{ background:"var(--color-brand-surface)", borderBottom:"1px solid var(--color-brand-border)", padding:"0.875rem 1.5rem", display:"flex", alignItems:"center", gap:"0.75rem" }}>
          <button id="btn-back-settlement" onClick={() => router.push("/owner")} style={{ background:"transparent", border:"1px solid var(--color-brand-border)", borderRadius:"8px", padding:"5px 12px", color:"var(--color-brand-muted)", cursor:"pointer", fontSize:"0.8rem", fontFamily:"var(--font-display)" }}>← Dashboard</button>
          <span style={{ fontSize:"1.25rem" }}>📄</span>
          <span style={{ fontWeight:"700", color:"var(--color-brand-text)" }}>Auto-Settlement Engine</span>
        </header>
        <div style={{ maxWidth:"900px", margin:"0 auto", padding:"2rem 1.5rem" }}>
          <div className="no-print" style={{ background:"var(--color-brand-card)", border:"1px solid var(--color-brand-border)", borderRadius:"var(--radius-xl)", padding:"2rem", marginBottom:"1.5rem" }}>
            <h1 style={{ fontSize:"1.2rem", fontWeight:"700", marginBottom:"0.4rem" }}>Generate Laporan Settlement</h1>
            <p style={{ color:"var(--color-brand-muted)", fontSize:"0.875rem", marginBottom:"1.5rem" }}>Sistem otomatis membelah pendapatan berdasarkan komisi vendor yang dikonfigurasi.</p>
            <div style={{ display:"flex", gap:"1rem", alignItems:"flex-end" }}>
              <div style={{ flex:1 }}>
                <label htmlFor="settlement-date" style={{ display:"block", fontSize:"0.75rem", color:"var(--color-brand-muted)", textTransform:"uppercase" as const, letterSpacing:"0.08em", fontWeight:"600", marginBottom:"0.4rem" }}>Tanggal Event</label>
                <input id="settlement-date" type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={{ width:"100%", background:"var(--color-brand-surface)", border:"1px solid var(--color-brand-border)", borderRadius:"10px", padding:"0.75rem 0.875rem", color:"var(--color-brand-text)", fontSize:"1rem", fontFamily:"var(--font-display)", outline:"none" }}/>
              </div>
              <button id="btn-generate-report" onClick={handleGenerate} disabled={loading}
                style={{ padding:"0.75rem 2rem", borderRadius:"var(--radius-xl)", background:"linear-gradient(135deg, var(--color-brand-green), var(--color-brand-green-dark))", border:"none", color:"white", fontSize:"1rem", fontWeight:"700", cursor:loading?"not-allowed":"pointer", fontFamily:"var(--font-display)", whiteSpace:"nowrap" as const, boxShadow:"0 8px 25px rgba(16,185,129,0.3)" }}>
                {loading ? "⏳ Memproses..." : "📊 Generate Report"}
              </button>
            </div>
          </div>

          {report && (
            <div>
              {/* Summary */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1rem", marginBottom:"1.5rem" }}>
                {[
                  { label:"Total Gross", value:formatRupiah(report.total_gross), color:"var(--color-brand-green)" },
                  { label:"Total Transfer ke Vendor", value:formatRupiah(report.total_payout), color:"var(--color-brand-yellow)" },
                  { label:"Masuk Kas Vynalee", value:formatRupiah(report.total_margin), color:"var(--color-brand-accent-light)" },
                ].map(c => (
                  <div key={c.label} style={{ background:"var(--color-brand-card)", border:"1px solid var(--color-brand-border)", borderRadius:"var(--radius-xl)", padding:"1.25rem" }}>
                    <div style={{ fontSize:"0.75rem", color:"var(--color-brand-muted)", textTransform:"uppercase" as const, letterSpacing:"0.08em", fontWeight:"600", marginBottom:"0.5rem" }}>{c.label}</div>
                    <div style={{ fontSize:"1.875rem", fontWeight:"800", color:c.color, fontFamily:"var(--font-mono)", letterSpacing:"-0.02em" }}>{c.value}</div>
                  </div>
                ))}
              </div>

              {/* Vendor breakdown */}
              <div style={{ background:"var(--color-brand-card)", border:"1px solid var(--color-brand-border)", borderRadius:"var(--radius-xl)", overflow:"hidden", marginBottom:"1.25rem" }}>
                <div className="no-print" style={{ padding:"1rem 1.5rem", borderBottom:"1px solid var(--color-brand-border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontWeight:"700", fontSize:"0.95rem" }}>📋 Rincian Per Vendor</span>
                  <div style={{ display:"flex", gap:"0.5rem" }}>
                    <button id="btn-export-csv" onClick={handleExportCsv} style={{ background:"var(--color-brand-accent)", border:"none", borderRadius:"8px", padding:"6px 14px", color:"white", cursor:"pointer", fontSize:"0.8rem", fontWeight:"600", fontFamily:"var(--font-display)" }}>📥 Export CSV</button>
                    <button id="btn-print-settlement" onClick={() => window.print()} style={{ background:"var(--color-brand-green)", border:"none", borderRadius:"8px", padding:"6px 14px", color:"white", cursor:"pointer", fontSize:"0.8rem", fontWeight:"600", fontFamily:"var(--font-display)" }}>🖨️ Print</button>
                  </div>
                </div>
                <div style={{ overflowX:"auto" as const }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.875rem" }}>
                    <thead>
                      <tr>{["Vendor","Komisi","Item Terjual","Gross Revenue","Transfer ke Vendor","Margin Vynalee"].map(h => (
                        <th key={h} style={{ padding:"0.75rem 1rem", textAlign:"left" as const, background:"var(--color-brand-surface)", color:"var(--color-brand-muted)", fontWeight:"600", fontSize:"0.72rem", textTransform:"uppercase" as const, letterSpacing:"0.07em", border:"1px solid var(--color-brand-border)", whiteSpace:"nowrap" as const }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {report.vendors.map(v => (
                        <tr key={v.vendor_id} style={{ borderBottom:"1px solid var(--color-brand-border)" }}>
                          <td style={{ padding:"0.75rem 1rem", fontWeight:"600", color:"var(--color-brand-text)", border:"1px solid var(--color-brand-border)" }}>{v.vendor_name}</td>
                          <td style={{ padding:"0.75rem 1rem", color:"var(--color-brand-muted)", border:"1px solid var(--color-brand-border)", fontFamily:"var(--font-mono)" }}>{v.commission_rate}%</td>
                          <td style={{ padding:"0.75rem 1rem", fontFamily:"var(--font-mono)", fontWeight:"700", border:"1px solid var(--color-brand-border)" }}>{v.items_sold} pcs</td>
                          <td style={{ padding:"0.75rem 1rem", fontFamily:"var(--font-mono)", fontWeight:"700", color:"var(--color-brand-text)", border:"1px solid var(--color-brand-border)" }}>{formatRupiah(v.gross_revenue)}</td>
                          <td style={{ padding:"0.75rem 1rem", fontFamily:"var(--font-mono)", fontWeight:"700", color:"var(--color-brand-yellow)", border:"1px solid var(--color-brand-border)" }}>{formatRupiah(v.vendor_payout)}</td>
                          <td style={{ padding:"0.75rem 1rem", fontFamily:"var(--font-mono)", fontWeight:"700", color:"var(--color-brand-green)", border:"1px solid var(--color-brand-border)" }}>{formatRupiah(v.vynalee_margin)}</td>
                        </tr>
                      ))}
                      <tr style={{ background:"var(--color-brand-surface)", fontWeight:"700" }}>
                        <td colSpan={2} style={{ padding:"0.875rem 1rem", border:"1px solid var(--color-brand-border)", color:"var(--color-brand-text)", fontWeight:"800" }}>TOTAL</td>
                        <td style={{ padding:"0.875rem 1rem", border:"1px solid var(--color-brand-border)", fontFamily:"var(--font-mono)", fontWeight:"800" }}>{report.vendors.reduce((s,v)=>s+v.items_sold,0)} pcs</td>
                        <td style={{ padding:"0.875rem 1rem", border:"1px solid var(--color-brand-border)", fontFamily:"var(--font-mono)", fontWeight:"800", color:"var(--color-brand-text)" }}>{formatRupiah(report.total_gross)}</td>
                        <td style={{ padding:"0.875rem 1rem", border:"1px solid var(--color-brand-border)", fontFamily:"var(--font-mono)", fontWeight:"800", color:"var(--color-brand-yellow)" }}>{formatRupiah(report.total_payout)}</td>
                        <td style={{ padding:"0.875rem 1rem", border:"1px solid var(--color-brand-border)", fontFamily:"var(--font-mono)", fontWeight:"800", color:"var(--color-brand-green)" }}>{formatRupiah(report.total_margin)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <p style={{ fontSize:"0.75rem", color:"var(--color-brand-muted)", textAlign:"center" as const }}>Generated: {new Date(report.generated_at).toLocaleString("id-ID")}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
