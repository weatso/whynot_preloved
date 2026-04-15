"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { supabase } from "@/lib/supabase";
import { generateSkuBatch, formatRupiah, type GeneratedSku } from "@/lib/skuGenerator";
import type { Vendor } from "@/lib/supabase";

export default function GeneratePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [count, setCount] = useState(50);
  const [price, setPrice] = useState(100000);
  const [prefix, setPrefix] = useState("PRL");
  const [vendorId, setVendorId] = useState<string>("");
  const [costPrice, setCostPrice] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedSku[]|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => { if (!user) router.replace("/login"); else if (user.role !== "owner") router.replace("/kasir"); }, [user, router]);

  useEffect(() => {
    supabase.from("vendors").select("*").eq("is_active",true).then(({data}) => {
      if (data) { setVendors(data as Vendor[]); setVendorId(data[0]?.id || ""); }
    });
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true); setError(null); setResult(null); setSuccess(false);
    const { success:ok, items, error:err } = await generateSkuBatch(count, price, prefix, vendorId || null, costPrice);
    setIsGenerating(false);
    if (!ok) { setError(err ?? "Error"); setResult(items); } else { setResult(items); setSuccess(true); }
  };

  const selectedVendor = vendors.find(v => v.id === vendorId);
  const pLabel = price >= 1000 ? `${Math.round(price/1000)}K` : `${price}`;

  if (!user || user.role !== "owner") return null;

  return (
    <>
      <style>{`@media print { body * { visibility:hidden; } #print-area,#print-area * { visibility:visible; } #print-area { position:absolute; top:0; left:0; width:100%; } .no-print { display:none !important; } }`}</style>
      <div style={{ minHeight:"100vh", background:"var(--color-brand-bg)", fontFamily:"var(--font-display)" }}>
        <header className="no-print" style={{ background:"var(--color-brand-surface)", borderBottom:"1px solid var(--color-brand-border)", padding:"0.875rem 1.5rem", display:"flex", alignItems:"center", gap:"0.75rem" }}>
          <button id="btn-back-owner" onClick={() => router.push("/owner")} style={{ background:"transparent", border:"1px solid var(--color-brand-border)", borderRadius:"8px", padding:"5px 12px", color:"var(--color-brand-muted)", cursor:"pointer", fontSize:"0.8rem", fontFamily:"var(--font-display)" }}>← Dashboard</button>
          <span style={{ fontSize:"1.25rem" }}>🏷️</span>
          <span style={{ fontWeight:"700", color:"var(--color-brand-text)" }}>Generate SKU Batch</span>
        </header>
        <div style={{ maxWidth:"800px", margin:"0 auto", padding:"2rem 1.5rem" }}>
          <div className="no-print" style={{ background:"var(--color-brand-card)", border:"1px solid var(--color-brand-border)", borderRadius:"var(--radius-xl)", padding:"2rem", marginBottom:"1.5rem" }}>
            <h1 style={{ fontSize:"1.2rem", fontWeight:"700", marginBottom:"0.4rem" }}>Generate Label SKU</h1>
            <p style={{ color:"var(--color-brand-muted)", fontSize:"0.875rem", marginBottom:"1.75rem" }}>Bulk insert items ke database + cetak label thermal.</p>
            <form onSubmit={handleGenerate}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))", gap:"1rem", marginBottom:"1.25rem" }}>
                {[
                  { id:"input-prefix", label:"Prefix", value:prefix, type:"text", onChange:(v:string) => setPrefix(v.toUpperCase()), maxLen:5 },
                  { id:"input-count", label:"Jumlah", value:count, type:"number", onChange:(v:string) => setCount(Number(v)), min:1, max:500 },
                  { id:"input-price", label:"Harga Jual (Rp)", value:price, type:"number", onChange:(v:string) => setPrice(Number(v)), min:1000, step:1000 },
                  { id:"input-cost", label:"Harga Modal (Rp)", value:costPrice, type:"number", onChange:(v:string) => setCostPrice(Number(v)), min:0, step:1000 },
                ].map(({id,label,value,type,onChange,maxLen,min,max,step}) => (
                  <div key={id}>
                    <label htmlFor={id} style={{ display:"block", fontSize:"0.75rem", color:"var(--color-brand-muted)", textTransform:"uppercase" as const, letterSpacing:"0.08em", fontWeight:"600", marginBottom:"0.4rem" }}>{label}</label>
                    <input id={id} type={type} value={value as string|number} onChange={e => onChange(e.target.value)} maxLength={maxLen} min={min} max={max} step={step}
                      style={{ width:"100%", background:"var(--color-brand-surface)", border:"1px solid var(--color-brand-border)", borderRadius:"10px", padding:"0.75rem 0.875rem", color:"var(--color-brand-text)", fontSize:"1rem", fontWeight:"700", fontFamily:"var(--font-mono)", outline:"none" }}/>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom:"1.25rem" }}>
                <label htmlFor="input-vendor" style={{ display:"block", fontSize:"0.75rem", color:"var(--color-brand-muted)", textTransform:"uppercase" as const, letterSpacing:"0.08em", fontWeight:"600", marginBottom:"0.4rem" }}>Vendor / Pemilik Barang</label>
                <select id="input-vendor" value={vendorId} onChange={e => setVendorId(e.target.value)}
                  style={{ width:"100%", background:"var(--color-brand-surface)", border:"1px solid var(--color-brand-border)", borderRadius:"10px", padding:"0.75rem 0.875rem", color:"var(--color-brand-text)", fontSize:"0.95rem", fontWeight:"600", fontFamily:"var(--font-display)", outline:"none", cursor:"pointer" }}>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name} ({v.commission_rate_percentage}% komisi)</option>)}
                </select>
                {selectedVendor && selectedVendor.commission_rate_percentage > 0 && (
                  <div style={{ marginTop:"0.5rem", fontSize:"0.8rem", color:"var(--color-brand-yellow)" }}>
                    💡 Hitung margin: Rp {price.toLocaleString("id-ID")} × {100-selectedVendor.commission_rate_percentage}% = <strong>{formatRupiah(price*(1-selectedVendor.commission_rate_percentage/100))}</strong> per item ke Vynalee
                  </div>
                )}
              </div>
              {count > 0 && price > 0 && prefix && (
                <div style={{ background:"rgba(124,58,237,0.1)", border:"1px solid rgba(124,58,237,0.3)", borderRadius:"10px", padding:"0.875rem", marginBottom:"1.25rem", fontSize:"0.875rem", color:"var(--color-brand-accent-light)", fontFamily:"var(--font-mono)" }}>
                  Preview: <strong>{prefix}-{pLabel}-001</strong> ... <strong>{prefix}-{pLabel}-{String(count).padStart(3,"0")}</strong>
                  <span style={{ marginLeft:"1.5rem", color:"var(--color-brand-muted)", fontFamily:"var(--font-display)" }}>
                    Total nilai: <strong style={{ color:"var(--color-brand-green)" }}>{formatRupiah(price*count)}</strong>
                  </span>
                </div>
              )}
              <button id="btn-generate-sku" type="submit" disabled={isGenerating}
                style={{ width:"100%", padding:"1rem", borderRadius:"var(--radius-xl)", background:isGenerating?"var(--color-brand-surface)":"linear-gradient(135deg, var(--color-brand-accent), #5b21b6)", border:"none", color:"white", fontSize:"1.05rem", fontWeight:"700", cursor:isGenerating?"not-allowed":"pointer", fontFamily:"var(--font-display)", boxShadow:isGenerating?"none":"0 8px 25px rgba(124,58,237,0.35)" }}>
                {isGenerating ? "⏳ Generating..." : `🏷️ Generate ${count} SKU`}
              </button>
            </form>
            {error && <div className="slide-in" style={{ marginTop:"1rem", padding:"0.875rem", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:"10px", color:"var(--color-brand-red)", fontSize:"0.875rem", fontWeight:"600" }}>❌ {error}</div>}
            {success && <div className="slide-in" style={{ marginTop:"1rem", padding:"0.875rem", background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.3)", borderRadius:"10px", color:"var(--color-brand-green)", fontSize:"0.875rem", fontWeight:"600" }}>✅ {result?.length} SKU berhasil dibuat!</div>}
          </div>

          {result && result.length > 0 && (
            <div style={{ background:"var(--color-brand-card)", border:"1px solid var(--color-brand-border)", borderRadius:"var(--radius-xl)", overflow:"hidden" }}>
              <div className="no-print" style={{ padding:"1rem 1.5rem", borderBottom:"1px solid var(--color-brand-border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontWeight:"700", color:"var(--color-brand-text)" }}>{result.length} Label Siap Cetak</span>
                <button id="btn-print" onClick={() => window.print()} style={{ background:"var(--color-brand-green)", border:"none", borderRadius:"8px", padding:"7px 16px", color:"white", cursor:"pointer", fontSize:"0.875rem", fontWeight:"600", fontFamily:"var(--font-display)" }}>🖨️ Print</button>
              </div>
              <div id="print-area" style={{ padding:"1rem", overflowX:"auto" as const }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.8rem" }}>
                  <thead>
                    <tr>{["No","ID / Barcode","Harga","Vendor","Status"].map(h => <th key={h} style={{ padding:"0.625rem 0.875rem", textAlign:"left" as const, background:"var(--color-brand-surface)", color:"var(--color-brand-muted)", fontWeight:"600", fontSize:"0.7rem", textTransform:"uppercase" as const, letterSpacing:"0.08em", border:"1px solid var(--color-brand-border)" }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {result.map((item,idx) => (
                      <tr key={item.id}>
                        <td style={{ padding:"0.5rem 0.875rem", border:"1px solid var(--color-brand-border)", color:"var(--color-brand-muted)", fontSize:"0.75rem" }}>{idx+1}</td>
                        <td style={{ padding:"0.5rem 0.875rem", border:"1px solid var(--color-brand-border)", fontFamily:"var(--font-mono)", fontWeight:"700", letterSpacing:"0.05em" }}>{item.id}</td>
                        <td style={{ padding:"0.5rem 0.875rem", border:"1px solid var(--color-brand-border)", fontWeight:"700", color:"var(--color-brand-green)", fontFamily:"var(--font-mono)" }}>{formatRupiah(item.price)}</td>
                        <td style={{ padding:"0.5rem 0.875rem", border:"1px solid var(--color-brand-border)", fontSize:"0.75rem", color:"var(--color-brand-muted)" }}>{selectedVendor?.name || "—"}</td>
                        <td style={{ padding:"0.5rem 0.875rem", border:"1px solid var(--color-brand-border)" }}><span style={{ background:"rgba(16,185,129,0.15)", color:"var(--color-brand-green)", borderRadius:"20px", padding:"2px 8px", fontSize:"0.7rem", fontWeight:"600" }}>available</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
