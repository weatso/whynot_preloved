"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import Barcode from "react-barcode";
import { PageHeader } from "@/components/PageHeader";

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
    if (!user || user.role !== "owner") router.replace("/login");
    else fetchVendors();
  }, [user, router]);

  const fetchVendors = async () => {
    const { data } = await supabase.from("vendors").select("id, code, name, item_count").eq("is_active", true);
    if (data) { setVendors(data); if (data.length > 0) setVendorId(data[0].id); }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !vendorId) return alert("Nama, Harga, dan Vendor wajib diisi!");
    setLoading(true);
    const vendor = vendors.find(v => v.id === vendorId);
    let currentCount = vendor.item_count || 0;
    const newItems: any[] = [];

    if (mode === "mass") {
      const quantity = parseInt(qty);
      for (let i = 1; i <= quantity; i++) {
        newItems.push({
          id: `${vendor.code}-${(currentCount + i).toString().padStart(4, "0")}`,
          vendor_id: vendor.id, name: name.trim(),
          category, price: parseInt(price), status: "available",
        });
      }
      currentCount += quantity;
    } else {
      newItems.push({
        id: `${vendor.code}-${(currentCount + 1).toString().padStart(4, "0")}`,
        vendor_id: vendor.id, name: name.trim(), category,
        price: parseInt(price), size: size || null, condition: condition || null, status: "available",
      });
      currentCount += 1;
    }

    const { error } = await supabase.from("items").insert(newItems);
    if (error) { alert("Gagal menyimpan ke database. ID bentrok, silakan coba lagi."); console.error(error); }
    else {
      await supabase.from("vendors").update({ item_count: currentCount }).eq("id", vendor.id);
      setGeneratedItems(newItems);
      setName(""); setPrice(""); setSize(""); setCondition("");
      fetchVendors();
    }
    setLoading(false);
  };

  if (!user) return null;

  return (
    <div className="wnp-page">
      <PageHeader title="Generate SKU &amp; Barcode">
        {generatedItems.length > 0 && (
          <button onClick={() => window.print()} className="wnp-btn wnp-btn-success no-print">
            🖨️ Print Label
          </button>
        )}
      </PageHeader>

      <div className="wnp-page-content no-print">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Flex row on tablet+ */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* FORM PANEL */}
            <div className="wnp-card" style={{ flex: "1.5" }}>
              {/* Tab Selector */}
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--color-brand-border)", paddingBottom: "1rem" }}>
                <button
                  onClick={() => setMode("single")}
                  className="wnp-btn"
                  style={{
                    flex: 1, fontSize: "0.85rem",
                    background: mode === "single" ? "var(--color-brand-accent)" : "transparent",
                    color: mode === "single" ? "white" : "var(--color-brand-muted)",
                    border: "1px solid var(--color-brand-border)",
                  }}
                >
                  1 Satuan (Detail)
                </button>
                <button
                  onClick={() => setMode("mass")}
                  className="wnp-btn"
                  style={{
                    flex: 1, fontSize: "0.85rem",
                    background: mode === "mass" ? "var(--color-brand-green-dark)" : "transparent",
                    color: mode === "mass" ? "white" : "var(--color-brand-muted)",
                    border: "1px solid var(--color-brand-border)",
                  }}
                >
                  Massal (Cepat)
                </button>
              </div>

              <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.4rem" }}>Vendor Pemilik</label>
                  <select value={vendorId} onChange={e => setVendorId(e.target.value)} className="wnp-input">
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name} (Code: {v.code})</option>)}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.4rem" }}>Nama Barang</label>
                    <input type="text" placeholder="Kemeja Flannel Preloved" value={name} onChange={e => setName(e.target.value)} className="wnp-input" />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.4rem" }}>Harga (Rp)</label>
                    <input type="number" placeholder="50000" value={price} onChange={e => setPrice(e.target.value)} className="wnp-input" />
                  </div>
                </div>

                {mode === "single" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
                    <div>
                      <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.4rem" }}>Kategori</label>
                      <select value={category} onChange={e => setCategory(e.target.value)} className="wnp-input">
                        <option>Pakaian</option><option>Tas</option><option>Sepatu</option><option>Lainnya</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.4rem" }}>Ukuran</label>
                      <input type="text" placeholder="M/L/XL" value={size} onChange={e => setSize(e.target.value)} className="wnp-input" />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.4rem" }}>Kondisi</label>
                      <input type="text" placeholder="Mulus 90%" value={condition} onChange={e => setCondition(e.target.value)} className="wnp-input" />
                    </div>
                  </div>
                )}

                {mode === "mass" && (
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "var(--color-brand-green)", display: "block", marginBottom: "0.4rem", fontWeight: "bold" }}>
                      Jumlah Label (1–200)
                    </label>
                    <input type="number" min="1" max="200" value={qty} onChange={e => setQty(e.target.value)} className="wnp-input"
                      style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--color-brand-green)", borderColor: "var(--color-brand-green)" }} />
                  </div>
                )}

                <button
                  type="submit" disabled={loading}
                  className="wnp-btn"
                  style={{
                    background: mode === "single" ? "var(--color-brand-accent)" : "var(--color-brand-green-dark)",
                    color: "white", fontSize: "1rem", marginTop: "0.5rem",
                  }}
                >
                  {loading ? "Memproses..." : `⚡ Generate ${mode === "single" ? "Satuan" : "Massal"}`}
                </button>
              </form>
            </div>

            {/* PREVIEW PANEL */}
            <div className="wnp-card" style={{ flex: 1, borderStyle: "dashed" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "1rem" }}>
                📋 Preview Label ({generatedItems.length} item)
              </h2>

              <div style={{ maxHeight: "480px", overflowY: "auto" }}>
                {generatedItems.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-brand-muted)" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🖨️</div>
                    Generate item dulu untuk melihat preview
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: mode === "single" ? "1fr" : "1fr 1fr", gap: "0.5rem" }}>
                    {generatedItems.slice(0, 20).map(item => (
                      <div key={item.id} style={{
                        background: "white", color: "black", padding: "0.6rem", borderRadius: "4px",
                        textAlign: "center", border: "1px solid #ccc",
                      }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: "bold", textTransform: "uppercase" }}>WNP PRELOVED</div>
                        <Barcode value={item.id} displayValue height={40} width={1.5} margin={0} fontSize={11} background="transparent" />
                        <div style={{ fontSize: "0.85rem", fontWeight: "bold", color: "green" }}>Rp {item.price.toLocaleString("id-ID")}</div>
                        {item.size && <div style={{ fontSize: "0.7rem" }}>Size: {item.size}</div>}
                      </div>
                    ))}
                    {generatedItems.length > 20 && (
                      <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--color-brand-muted)", fontSize: "0.85rem", padding: "1rem" }}>
                        +{generatedItems.length - 20} item lagi (semua akan tercetak saat print)
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PRINT STYLES */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .no-print { display: none !important; }
          #printable-area, #printable-area * { visibility: visible; }
          #printable-area {
            position: absolute; left: 0; top: 0; width: 100%;
            display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 4px;
          }
          .print-label { border: 1px dashed #999; padding: 6px; text-align: center; page-break-inside: avoid; }
        }
        @media (min-width: 768px) {
          .gen-layout { flex-direction: row !important; }
        }
      `}} />

      {/* PRINT AREA */}
      <div id="printable-area" style={{ display: "none" }}>
        {generatedItems.map(item => (
          <div key={item.id} className="print-label" style={{ color: "black", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: "10px", fontWeight: "bold", marginBottom: "3px" }}>WNP PRELOVED</div>
            <Barcode value={item.id} displayValue height={50} width={1.8} margin={0} fontSize={14} background="transparent" />
            <div style={{ fontSize: "14px", fontWeight: "bold", marginTop: "3px" }}>Rp {item.price.toLocaleString("id-ID")}</div>
            {item.size && <div style={{ fontSize: "10px" }}>Size: {item.size}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}