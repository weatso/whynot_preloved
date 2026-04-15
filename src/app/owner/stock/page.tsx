"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import Barcode from "react-barcode"; // Pastikan ini tetap ada

export default function StockPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal State
  const [editingItem, setEditingItem] = useState<any>(null);
  const [printItem, setPrintItem] = useState<any>(null);

  useEffect(() => {
    if (!user || user.role !== "owner") router.replace("/login");
    else fetchStock();
  }, [user, router]);

  const fetchStock = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("items")
      .select("*, vendors(name)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data) setItems(data);
    setLoading(false);
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const { id, name, price, category, size, status } = editingItem;
    
    const { error } = await supabase.from("items").update({
      name, price: Number(price), category, size, status
    }).eq("id", id);

    if (error) alert("Gagal update data barang.");
    else {
      setEditingItem(null);
      fetchStock();
    }
  };

  const triggerPrint = (item: any) => {
    setPrintItem(item);
    setTimeout(() => window.print(), 100); 
  };

  const filteredItems = items.filter(i => {
    const matchStatus = statusFilter === "all" || i.status === statusFilter;
    const searchLow = search.toLowerCase();
    const matchSearch = i.id.toLowerCase().includes(searchLow) || i.name.toLowerCase().includes(searchLow);
    return matchStatus && matchSearch;
  });

  if (!user) return null;

  return (
    <div style={{ padding: "2rem", background: "var(--color-brand-bg)", minHeight: "100vh", color: "white" }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>Database Stok Barang</h1>
        <button onClick={() => router.push("/owner")} style={{ padding: "0.5rem 1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", cursor: "pointer" }}>← Dashboard</button>
      </div>

      <div className="no-print" style={{ background: "var(--color-brand-card)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-brand-border)" }}>
        
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
          <input type="text" placeholder="Cari ID atau Nama Barang..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 2, padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ flex: 1, padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }}>
            <option value="all">Semua Status</option>
            <option value="available">Tersedia (Available)</option>
            <option value="sold">Terjual (Sold)</option>
            <option value="in_cart">Di Keranjang Kasir</option>
            <option value="void">Dibatalkan (Void / Retur)</option>
          </select>
          <button onClick={fetchStock} style={{ padding: "1rem 1.5rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", cursor: "pointer" }}>🔄 Refresh</button>
        </div>

        <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid var(--color-brand-border)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "var(--color-brand-surface)", color: "var(--color-brand-muted)", fontSize: "0.85rem", textTransform: "uppercase" }}>
                <th style={{ padding: "1rem", borderBottom: "1px solid var(--color-brand-border)" }}>ID Barang</th>
                <th style={{ padding: "1rem", borderBottom: "1px solid var(--color-brand-border)" }}>Nama Barang</th>
                <th style={{ padding: "1rem", borderBottom: "1px solid var(--color-brand-border)" }}>Vendor</th>
                <th style={{ padding: "1rem", borderBottom: "1px solid var(--color-brand-border)" }}>Harga</th>
                <th style={{ padding: "1rem", borderBottom: "1px solid var(--color-brand-border)" }}>Status</th>
                <th style={{ padding: "1rem", borderBottom: "1px solid var(--color-brand-border)" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center" }}>Memuat data...</td></tr> : filteredItems.map(i => (
                <tr key={i.id} style={{ borderBottom: "1px solid var(--color-brand-border)", background: "var(--color-brand-card)" }}>
                  <td style={{ padding: "1rem", fontFamily: "var(--font-mono)", fontWeight: "bold" }}>{i.id}</td>
                  <td style={{ padding: "1rem" }}>{i.name} <br/><span style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)" }}>{i.category} {i.size ? `• Size: ${i.size}` : ''}</span></td>
                  <td style={{ padding: "1rem", color: "var(--color-brand-muted)" }}>{i.vendors?.name || "WNP"}</td>
                  <td style={{ padding: "1rem", fontWeight: "bold", color: "var(--color-brand-green)" }}>Rp {i.price.toLocaleString("id-ID")}</td>
                  <td style={{ padding: "1rem" }}>{i.status}</td>
                  <td style={{ padding: "1rem" }}>
                    <button onClick={() => setEditingItem(i)} style={{ padding: "0.5rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "4px", marginRight: "0.5rem", cursor: "pointer" }}>✏️ Edit</button>
                    <button onClick={() => triggerPrint(i)} style={{ padding: "0.5rem", background: "var(--color-brand-green-dark)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>🖨️ Cetak</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL EDIT BERSIH */}
      {editingItem && (
        <div className="no-print" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "var(--color-brand-card)", padding: "2rem", borderRadius: "var(--radius-xl)", width: "100%", maxWidth: "500px", border: "1px solid var(--color-brand-border)" }}>
            <h2 style={{ marginBottom: "1.5rem" }}>Edit Barang: {editingItem.id}</h2>
            <form onSubmit={handleUpdateItem} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <input type="text" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} placeholder="Nama Barang" style={{ padding: "0.8rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px" }} />
              <div style={{ display: "flex", gap: "1rem" }}>
                <input type="number" value={editingItem.price} onChange={e => setEditingItem({...editingItem, price: e.target.value})} placeholder="Harga Jual" style={{ flex: 1, padding: "0.8rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px" }} />
                <input type="text" value={editingItem.size || ''} onChange={e => setEditingItem({...editingItem, size: e.target.value})} placeholder="Ukuran (Opsional)" style={{ flex: 1, padding: "0.8rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px" }} />
              </div>
              <select value={editingItem.status} onChange={e => setEditingItem({...editingItem, status: e.target.value})} style={{ padding: "0.8rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px" }}>
                <option value="available">Tersedia (Available)</option>
                <option value="sold">Terjual (Sold)</option>
                <option value="void">Dibatalkan (Void / Retur)</option>
              </select>
              <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                <button type="submit" style={{ flex: 1, padding: "1rem", background: "var(--color-brand-accent)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>Simpan Perubahan</button>
                <button type="button" onClick={() => setEditingItem(null)} style={{ padding: "1rem", background: "transparent", color: "var(--color-brand-muted)", border: "none", cursor: "pointer" }}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENDER BARCODE KHUSUS UNTUK PRINTER SATUAN */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .no-print { display: none !important; }
          #single-print-area, #single-print-area * { visibility: visible; }
          #single-print-area { position: absolute; left: 0; top: 0; }
        }
      `}} />
      
      {printItem && (
        <div id="single-print-area" style={{ display: "none", width: "50mm", padding: "10px", color: "black", border: "1px solid black", textAlign: "center", fontFamily: "sans-serif", margin: "0 auto" }}>
          <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>WNP PRELOVED</div>
          
          <div style={{ display: "flex", justifyContent: "center", margin: "5px 0", transform: "scale(0.85)", transformOrigin: "center" }}>
             <Barcode 
                value={printItem.id} 
                displayValue={true} 
                height={50} 
                width={1.5} 
                margin={0} 
                fontSize={16}
                background="transparent"
              />
          </div>

          <div style={{ fontSize: "16px", fontWeight: "bold" }}>Rp {printItem.price.toLocaleString("id-ID")}</div>
          {printItem.size && <div style={{ fontSize: "12px", marginTop: "4px" }}>Size: {printItem.size}</div>}
        </div>
      )}
    </div>
  );
}