"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";

export default function GenerateSKUPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [vendorId, setVendorId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Pakaian");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [generatedItems, setGeneratedItems] = useState<any[]>([]);

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
    if (!name || !price || !vendorId) return alert("Lengkapi data!");
    
    setLoading(true);
    const vendor = vendors.find(v => v.id === vendorId);
    const quantity = parseInt(qty);
    const currentCount = vendor.item_count || 0;
    
    const newItems = [];
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

    const { error } = await supabase.from("items").insert(newItems);
    
    if (error) {
      alert("Gagal generate SKU. Cek koneksi.");
      console.error(error);
    } else {
      await supabase.from("vendors").update({ item_count: currentCount + quantity }).eq("id", vendor.id);
      setGeneratedItems(newItems);
      setName(""); setPrice(""); setQty("1");
      fetchVendors(); // Update count
    }
    setLoading(false);
  };

  if (!user) return null;

  return (
    <div style={{ padding: "2rem", background: "var(--color-brand-bg)", minHeight: "100vh", color: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }} className="no-print">
        <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>Generate SKU Massal</h1>
        <button onClick={() => router.push("/owner")} style={{ padding: "0.5rem 1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", cursor: "pointer" }}>← Dashboard</button>
      </div>

      <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }} className="no-print">
        {/* PANEL INPUT */}
        <div style={{ flex: 1, background: "var(--color-brand-card)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-brand-border)" }}>
          <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            
            <div>
              <label style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)", marginBottom: "0.5rem", display: "block" }}>Pilih Vendor (Pemilik Barang)</label>
              <select value={vendorId} onChange={e => setVendorId(e.target.value)} style={{ width: "100%", padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }}>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name} (Code: {v.code})</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)", marginBottom: "0.5rem", display: "block" }}>Nama Barang (Umum)</label>
              <input type="text" placeholder="misal: Kemeja Flannel Preloved" value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }} />
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)", marginBottom: "0.5rem", display: "block" }}>Kategori</label>
                <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: "100%", padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }}>
                  <option value="Pakaian">Pakaian</option>
                  <option value="Tas">Tas</option>
                  <option value="Sepatu">Sepatu</option>
                  <option value="Aksesoris">Aksesoris</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)", marginBottom: "0.5rem", display: "block" }}>Harga Jual (Rp)</label>
                <input type="number" placeholder="50000" value={price} onChange={e => setPrice(e.target.value)} style={{ width: "100%", padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none", fontFamily: "var(--font-mono)" }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)", marginBottom: "0.5rem", display: "block" }}>Jumlah Label Dibuat</label>
              <input type="number" min="1" max="100" value={qty} onChange={e => setQty(e.target.value)} style={{ width: "100%", padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none", fontSize: "1.2rem", fontWeight: "bold" }} />
            </div>

            <button type="submit" disabled={loading} style={{ padding: "1.2rem", background: "var(--color-brand-accent)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer", marginTop: "1rem", fontSize: "1.1rem" }}>
              {loading ? "Memproses..." : "⚡ GENERATE SKU"}
            </button>
          </form>
        </div>

        {/* PANEL HASIL & PRINT */}
        <div style={{ flex: 1, background: "var(--color-brand-surface)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px dashed var(--color-brand-border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.2rem", color: "var(--color-brand-green)" }}>Label Siap Cetak</h2>
            {generatedItems.length > 0 && (
              <button onClick={() => window.print()} style={{ padding: "0.5rem 1rem", background: "var(--color-brand-green)", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>🖨️ Print Label</button>
            )}
          </div>
          
          <div style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "0.5rem" }}>
            {generatedItems.length === 0 ? (
              <p style={{ color: "var(--color-brand-muted)", textAlign: "center", marginTop: "2rem" }}>Belum ada label digenerate sesi ini.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {generatedItems.map(item => (
                  <div key={item.id} style={{ background: "white", color: "black", padding: "0.8rem", borderRadius: "4px", textAlign: "center", border: "1px solid #ccc" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: "bold", textTransform: "uppercase" }}>WNP Preloved</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: "900", fontFamily: "monospace", margin: "0.2rem 0" }}>{item.id}</div>
                    <div style={{ fontSize: "0.9rem", fontWeight: "bold" }}>Rp {item.price.toLocaleString("id-ID")}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STYLE KHUSUS UNTUK PRINT CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .no-print { display: none !important; }
          #printable-area, #printable-area * { visibility: visible; }
          #printable-area { position: absolute; left: 0; top: 0; width: 100%; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
          .print-label { border: 1px solid black; padding: 10px; text-align: center; }
        }
      `}} />

      {/* DUMMY HIDDEN AREA UNTUK PRINT SAJA */}
      <div id="printable-area" style={{ display: "none" }}>
        {generatedItems.map(item => (
          <div key={item.id} className="print-label" style={{ color: "black" }}>
            <div style={{ fontSize: "10px", fontWeight: "bold" }}>WNP Preloved</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", margin: "4px 0" }}>{item.id}</div>
            <div style={{ fontSize: "14px" }}>Rp {item.price.toLocaleString("id-ID")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}