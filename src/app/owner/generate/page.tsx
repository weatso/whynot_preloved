"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import Barcode from "react-barcode";

export default function GenerateSKUPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"single" | "mass">("single");
  
  const [vendorId, setVendorId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Pakaian");
  const [price, setPrice] = useState("");
  const [generatedItems, setGeneratedItems] = useState<any[]>([]);

  const [size, setSize] = useState("");
  const [condition, setCondition] = useState("");
  const [qty, setQty] = useState("10");

  useEffect(() => {
    if (!user || (user.role !== "owner" && user.role !== "admin")) router.replace("/login");
    else fetchVendors();
  }, [user, router]);

  const fetchVendors = async () => {
    const { data } = await supabase.from("vendors").select("id, code, name, item_count").eq("is_active", true);
    if (data) {
      setVendors(data);
      if (data.length > 0) setVendorId(data[0].id);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = parseInt(price.replace(/\D/g, ""));
    if (!name || !numericPrice || !vendorId) return alert("Nama, Harga, dan Vendor wajib diisi!");
    if (!user?.tenant_id) return alert("Sesi tidak valid. Silakan login ulang.");
    
    setLoading(true);
    const vendor = vendors.find(v => v.id === vendorId);
    let currentCount = vendor.item_count || 0;
    const newItems = [];

    if (mode === "mass") {
      const quantity = parseInt(qty);
      for (let i = 1; i <= quantity; i++) {
        const seqNumber = (currentCount + i).toString().padStart(4, '0');
        newItems.push({
          id: `${vendor.code}-${seqNumber}`,
          tenant_id: user.tenant_id,
          vendor_id: vendor.id,
          name: name.trim(),
          category,
          price: numericPrice,
          status: "available"
        });
      }
      currentCount += quantity;
    } else {
      const seqNumber = (currentCount + 1).toString().padStart(4, '0');
      newItems.push({
        id: `${vendor.code}-${seqNumber}`,
        tenant_id: user.tenant_id,
        vendor_id: vendor.id,
        name: name.trim(),
        category,
        price: numericPrice,
        size: size || null,
        condition: condition || null,
        status: "available"
      });
      currentCount += 1;
    }

    const { error } = await supabase.from("items").insert(newItems);
    
    if (error) {
      console.error("SKU generation error:", error);
      alert("Gagal menyimpan: " + error.message);
    } else {
      await supabase.from("vendors").update({ item_count: currentCount }).eq("id", vendor.id);
      setGeneratedItems(newItems);
      setName(""); setPrice(""); setSize(""); setCondition("");
      fetchVendors(); 
    }
    setLoading(false);
  };

  const triggerPrint = () => {
    setTimeout(() => window.print(), 300);
  };

  if (!user) return null;

  return (
    <>
      {/* UI UTAMA (Akan hilang total saat print karena class no-print) */}
      <div className="no-print" style={{ padding: "2rem", background: "var(--color-brand-bg)", minHeight: "100vh", color: "white" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>Generate SKU & Cetak Label</h1>
          <button onClick={() => router.push("/owner")} style={{ padding: "0.5rem 1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", cursor: "pointer" }}>← Dashboard</button>
        </div>

        <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
          <div style={{ flex: 1.5, background: "var(--color-brand-card)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-brand-border)" }}>
            <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", borderBottom: "1px solid var(--color-brand-border)", paddingBottom: "1rem" }}>
              <button onClick={() => setMode("single")} style={{ flex: 1, padding: "1rem", background: mode === "single" ? "var(--color-brand-surface)" : "transparent", color: mode === "single" ? "var(--color-brand-accent-light)" : "var(--color-brand-muted)", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>1. GENERATE SATUAN (Detail)</button>
              <button onClick={() => setMode("mass")} style={{ flex: 1, padding: "1rem", background: mode === "mass" ? "var(--color-brand-surface)" : "transparent", color: mode === "mass" ? "var(--color-brand-green)" : "var(--color-brand-muted)", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>2. GENERATE MASSAL (Cepat)</button>
            </div>

            <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)" }}>Vendor Pemilik</label>
                <select value={vendorId} onChange={e => setVendorId(e.target.value)} style={{ width: "100%", padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none", marginTop: "0.5rem" }}>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name} (Code: {v.code})</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)" }}>Nama Barang</label>
                  <input type="text" placeholder="misal: Kemeja Flannel" value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none", marginTop: "0.5rem" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)" }}>Harga (Rp)</label>
                  <input type="text" inputMode="numeric" placeholder="50.000" value={price ? Number(price.replace(/\D/g, "")).toLocaleString("id-ID") : ""}
                    onChange={e => {
                      const raw = e.target.value.replace(/\D/g, "").replace(/^0+/, "");
                      setPrice(raw);
                    }}
                    style={{ width: "100%", padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none", marginTop: "0.5rem" }} />
                </div>
              </div>

              {mode === "single" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)" }}>Kategori</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: "100%", padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none", marginTop: "0.5rem" }}>
                      <option value="Pakaian">Pakaian</option>
                      <option value="Tas">Tas</option>
                      <option value="Sepatu">Sepatu</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)" }}>Ukuran</label>
                    <input type="text" placeholder="M/L/XL" value={size} onChange={e => setSize(e.target.value)} style={{ width: "100%", padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none", marginTop: "0.5rem" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)" }}>Kondisi</label>
                    <input type="text" placeholder="Mulus 90%" value={condition} onChange={e => setCondition(e.target.value)} style={{ width: "100%", padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none", marginTop: "0.5rem" }} />
                  </div>
                </div>
              )}

              {mode === "mass" && (
                <div>
                  <label style={{ fontSize: "0.85rem", color: "var(--color-brand-green)" }}>Jumlah Label Digenerate Massal</label>
                  <input type="number" min="1" max="200" value={qty} onChange={e => setQty(e.target.value)} style={{ width: "100%", padding: "1.5rem", background: "var(--color-brand-surface)", color: "var(--color-brand-green)", border: "1px solid var(--color-brand-green)", borderRadius: "8px", outline: "none", marginTop: "0.5rem", fontSize: "1.5rem", fontWeight: "bold" }} />
                </div>
              )}

              <button type="submit" disabled={loading} style={{ padding: "1.2rem", background: mode === "single" ? "var(--color-brand-accent)" : "var(--color-brand-green-dark)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer", marginTop: "1rem", fontSize: "1.1rem" }}>
                {loading ? "Memproses..." : `⚡ GENERATE ${mode.toUpperCase()}`}
              </button>
            </form>
          </div>

          <div style={{ flex: 1, background: "var(--color-brand-surface)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px dashed var(--color-brand-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.2rem", color: "white" }}>Preview Label</h2>
              {generatedItems.length > 0 && (
                <button onClick={triggerPrint} style={{ padding: "0.5rem 1rem", background: "var(--color-brand-green)", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>🖨️ Print Label</button>
              )}
            </div>
            
            <div style={{ maxHeight: "500px", overflowY: "auto", paddingRight: "0.5rem" }}>
              {generatedItems.length === 0 ? (
                <p style={{ color: "var(--color-brand-muted)", textAlign: "center", marginTop: "2rem" }}>Belum ada data.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: mode === "single" ? "1fr" : "1fr 1fr", gap: "0.5rem" }}>
                  {generatedItems.map(item => (
                    <div key={item.id} style={{ background: "white", color: "black", padding: "0.8rem", borderRadius: "4px", textAlign: "center", border: "1px solid #ccc" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: "bold", letterSpacing: "0.05em" }}>WNP PRELOVED</div>
                      <div style={{ display: "flex", justifyContent: "center", margin: "0.3rem 0" }}>
                        <Barcode value={item.id} displayValue height={36} width={1.3} margin={0} fontSize={11} background="transparent" />
                      </div>
                      <div style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#16a34a" }}>Rp {item.price.toLocaleString("id-ID")}</div>
                      {item.name && <div style={{ fontSize: "0.65rem", color: "#555", marginTop: "0.15rem" }}>{item.name}{item.size ? ` · ${item.size}` : ""}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RENDER BARCODE KHUSUS UNTUK PRINTER */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          html, body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          /* Hide EVERYTHING except the print area */
          body > * { display: none !important; }
          #mass-print-area { display: flex !important; }
          /* Override: show nested content inside print area */
          #mass-print-area * { display: initial !important; }
          #mass-print-area { flex-wrap: wrap; justify-content: flex-start; gap: 10px; width: 100%; color: black; font-family: sans-serif; }
          .print-label-item { display: inline-block !important; page-break-inside: avoid; border: 1px dashed #999; padding: 10px; text-align: center; min-width: 40mm; }
        }
      `}} />

      <div id="mass-print-area" style={{ display: "none" }}>
        {generatedItems.map(item => (
          <div key={item.id} className="print-label-item">
            <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>WNP PRELOVED</div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "4px" }}>
              <Barcode value={item.id} displayValue={true} height={40} width={1.5} margin={0} fontSize={14} background="transparent" />
            </div>
            <div style={{ fontSize: "16px", fontWeight: "bold" }}>Rp {item.price.toLocaleString("id-ID")}</div>
            {item.size && <div style={{ fontSize: "10px", marginTop: "2px" }}>Size: {item.size}</div>}
          </div>
        ))}
      </div>
    </>
  );
}