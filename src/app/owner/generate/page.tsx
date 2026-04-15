"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import Barcode from "react-barcode"; // Pastikan ini tetap ada

export default function GenerateSKUPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"single" | "mass">("single");
  
  // Shared State
  const [vendorId, setVendorId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Pakaian");
  const [price, setPrice] = useState("");
  const [generatedItems, setGeneratedItems] = useState<any[]>([]);

  // Single Specific State
  const [size, setSize] = useState("");
  const [condition, setCondition] = useState("");

  // Mass Specific State
  const [qty, setQty] = useState("10");

  useEffect(() => {
    if (!user || user.role !== "owner") router.replace("/login");
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
    if (!name || !price || !vendorId) return alert("Nama, Harga, dan Vendor wajib diisi!");
    
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
          vendor_id: vendor.id,
          name: name.trim(),
          category,
          price: parseInt(price),
          status: "available"
        });
      }
      currentCount += quantity;
    } else {
      // Single Mode
      const seqNumber = (currentCount + 1).toString().padStart(4, '0');
      newItems.push({
        id: `${vendor.code}-${seqNumber}`,
        vendor_id: vendor.id,
        name: name.trim(),
        category,
        price: parseInt(price),
        size: size || null,
        condition: condition || null,
        status: "available"
      });
      currentCount += 1;
    }

    const { error } = await supabase.from("items").insert(newItems);
    
    if (error) {
      alert("Gagal menyimpan ke database. ID bentrok, silakan coba lagi.");
      console.error(error);
    } else {
      await supabase.from("vendors").update({ item_count: currentCount }).eq("id", vendor.id);
      setGeneratedItems(newItems);
      setName(""); setPrice(""); setSize(""); setCondition("");
      fetchVendors(); 
    }
    setLoading(false);
  };

  if (!user) return null;

  return (
    <div style={{ padding: "2rem", background: "var(--color-brand-bg)", minHeight: "100vh", color: "white" }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>Generate SKU & Barcode</h1>
        <button onClick={() => router.push("/owner")} style={{ padding: "0.5rem 1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", cursor: "pointer" }}>← Dashboard</button>
      </div>

      <div className="no-print" style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
        
        {/* PANEL KIRI: FORM */}
        <div style={{ flex: 1.5, background: "var(--color-brand-card)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-brand-border)" }}>
          
          {/* TAB SELECTOR */}
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
                <input type="text" placeholder="misal: Kemeja Flannel Preloved" value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none", marginTop: "0.5rem" }} />
              </div>
              <div>
                <label style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)" }}>Harga (Rp)</label>
                <input type="number" placeholder="50000" value={price} onChange={e => setPrice(e.target.value)} style={{ width: "100%", padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none", marginTop: "0.5rem" }} />
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

        {/* PANEL KANAN: HASIL PRINT */}
        <div style={{ flex: 1, background: "var(--color-brand-surface)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px dashed var(--color-brand-border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.2rem", color: "white" }}>Label Siap Cetak</h2>
            {generatedItems.length > 0 && (
              <button onClick={() => window.print()} style={{ padding: "0.5rem 1rem", background: "var(--color-brand-green)", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>🖨️ Print Label</button>
            )}
          </div>
          
          <div style={{ maxHeight: "500px", overflowY: "auto", paddingRight: "0.5rem" }}>
            {generatedItems.length === 0 ? (
              <p style={{ color: "var(--color-brand-muted)", textAlign: "center", marginTop: "2rem" }}>Belum ada data.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: mode === "single" ? "1fr" : "1fr 1fr", gap: "0.5rem" }}>
                {generatedItems.map(item => (
                  <div key={item.id} style={{ background: "white", color: "black", padding: "0.8rem", borderRadius: "4px", textAlign: "center", border: "1px solid #ccc" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: "bold", textTransform: "uppercase" }}>WNP PRELOVED</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: "900", fontFamily: "monospace", margin: "0.2rem 0" }}>{item.id}</div>
                    <div style={{ fontSize: "0.9rem", fontWeight: "bold", color: "green" }}>Rp {item.price.toLocaleString("id-ID")}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PRINT STYLES */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .no-print { display: none !important; }
          #printable-area, #printable-area * { visibility: visible; }
          #printable-area { position: absolute; left: 0; top: 0; width: 100%; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
          .print-label { border: 1px dashed black; padding: 10px; text-align: center; }
        }
      `}} />

      {/* RENDER BARCODE KHUSUS UNTUK PRINTER */}
      <div id="printable-area" style={{ display: "none" }}>
        {generatedItems.map(item => (
          <div key={item.id} className="print-label" style={{ color: "black", display: "flex", flexDirection: "column", alignItems: "center", padding: "10px" }}>
            <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>WNP PRELOVED</div>
            
            <div style={{ transform: "scale(0.85)", transformOrigin: "center" }}>
              <Barcode 
                value={item.id} 
                displayValue={true} 
                height={50} 
                width={1.8} 
                margin={0} 
                fontSize={16}
                background="transparent"
              />
            </div>

            <div style={{ fontSize: "16px", fontWeight: "bold", marginTop: "4px" }}>Rp {item.price.toLocaleString("id-ID")}</div>
            {item.size && <div style={{ fontSize: "12px" }}>Size: {item.size}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}