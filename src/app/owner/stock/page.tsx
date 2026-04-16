"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import Barcode from "react-barcode";
import { PageHeader } from "@/components/PageHeader";
import dynamic from "next/dynamic";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), { ssr: false });

export default function StockPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingItem, setEditingItem] = useState<any>(null);
  const [printItem, setPrintItem] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "owner") router.replace("/login");
    else fetchStock();
  }, [user, router]);

  const fetchStock = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("items").select("*, vendors(name)")
      .order("created_at", { ascending: false }).limit(500);
    if (data) setItems(data);
    setLoading(false);
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const { id, name, price, category, size, status } = editingItem;
    const { error } = await supabase.from("items").update({ name, price: Number(price), category, size, status }).eq("id", id);
    if (error) alert("Gagal update data barang.");
    else { setEditingItem(null); fetchStock(); }
  };

  const triggerPrint = (item: any) => {
    setPrintItem(item);
    setTimeout(() => window.print(), 100);
  };

  const filteredItems = items.filter(i => {
    const matchStatus = statusFilter === "all" || i.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = i.id.toLowerCase().includes(q) || i.name.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const statusBadgeClass = (status: string) => {
    if (status === "available") return "wnp-badge-green";
    if (status === "sold") return "wnp-badge-gray";
    if (status === "in_cart") return "wnp-badge-yellow";
    return "wnp-badge-red";
  };

  if (!user) return null;

  return (
    <div className="wnp-page">
      <PageHeader title="Database Stok Barang" />

      <div className="wnp-page-content no-print">

        <div className="wnp-card">
          {/* Filters */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
            <input
              type="text" placeholder="Cari ID atau Nama Barang..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="wnp-input" style={{ flex: "1 1 160px" }}
            />
            <button
              onClick={() => setShowScanner(true)}
              title="Scan barcode untuk cari barang"
              className="wnp-btn wnp-btn-ghost"
              style={{ flexShrink: 0 }}
            >
              📷 Scan
            </button>
            <select
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="wnp-input" style={{ flex: "1 1 140px" }}
            >
              <option value="all">Semua Status</option>
              <option value="available">Available</option>
              <option value="sold">Terjual</option>
              <option value="in_cart">Di Keranjang</option>
              <option value="void">Void / Retur</option>
            </select>
            <button onClick={fetchStock} className="wnp-btn wnp-btn-ghost" style={{ flexShrink: 0 }}>
              🔄 Refresh
            </button>
          </div>

          <div style={{ marginBottom: "0.75rem", color: "var(--color-brand-muted)", fontSize: "0.85rem" }}>
            Menampilkan {filteredItems.length} dari {items.length} barang
          </div>

          <div className="wnp-table-wrapper">
            <table className="wnp-table">
              <thead>
                <tr>
                  <th>ID Barang</th>
                  <th>Nama &amp; Kategori</th>
                  <th>Vendor</th>
                  <th>Harga</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--color-brand-muted)" }}>Memuat data...</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--color-brand-muted)" }}>Tidak ada barang ditemukan.</td></tr>
                ) : filteredItems.map(i => (
                  <tr key={i.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: "bold", fontSize: "0.85rem" }}>{i.id}</td>
                    <td>
                      <div style={{ fontWeight: "bold", color: "var(--color-brand-text)" }}>{i.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)" }}>
                        {i.category}{i.size ? ` • ${i.size}` : ""}
                      </div>
                    </td>
                    <td style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem" }}>{i.vendors?.name || "—"}</td>
                    <td style={{ fontWeight: "bold", color: "var(--color-brand-green)", whiteSpace: "nowrap" }}>
                      Rp {i.price.toLocaleString("id-ID")}
                    </td>
                    <td><span className={`wnp-badge ${statusBadgeClass(i.status)}`}>{i.status}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button onClick={() => setEditingItem(i)} className="wnp-btn wnp-btn-ghost" style={{ padding: "0.4rem 0.7rem", fontSize: "0.8rem" }}>✏️</button>
                        <button onClick={() => triggerPrint(i)} className="wnp-btn wnp-btn-success" style={{ padding: "0.4rem 0.7rem", fontSize: "0.8rem" }}>🖨️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editingItem && (
        <div className="wnp-modal-overlay no-print">
          <div className="wnp-modal fade-in">
            <h2 style={{ marginBottom: "1.25rem", fontSize: "1.1rem", fontWeight: "bold" }}>
              Edit Barang: <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-brand-accent-light)" }}>{editingItem.id}</span>
            </h2>
            <form onSubmit={handleUpdateItem} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <input type="text" value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} placeholder="Nama Barang" className="wnp-input" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <input type="number" value={editingItem.price} onChange={e => setEditingItem({ ...editingItem, price: e.target.value })} placeholder="Harga Jual" className="wnp-input" />
                <input type="text" value={editingItem.size || ""} onChange={e => setEditingItem({ ...editingItem, size: e.target.value })} placeholder="Ukuran" className="wnp-input" />
              </div>
              <select value={editingItem.status} onChange={e => setEditingItem({ ...editingItem, status: e.target.value })} className="wnp-input">
                <option value="available">Tersedia (Available)</option>
                <option value="sold">Terjual (Sold)</option>
                <option value="void">Dibatalkan (Void)</option>
              </select>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button type="submit" className="wnp-btn wnp-btn-primary" style={{ flex: 1 }}>Simpan Perubahan</button>
                <button type="button" onClick={() => setEditingItem(null)} className="wnp-btn wnp-btn-ghost">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera Scanner */}
      {showScanner && (
        <BarcodeScanner
          onScan={(val) => { setSearch(val); setShowScanner(false); }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .no-print { display: none !important; }
          #single-print-area, #single-print-area * { visibility: visible; }
          #single-print-area { position: absolute; left: 0; top: 0; }
        }
      `}} />

      {printItem && (
        <div id="single-print-area" style={{ display: "none", width: "50mm", padding: "8px", color: "black", textAlign: "center", fontFamily: "sans-serif" }}>
          <div style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "3px" }}>WNP PRELOVED</div>
          <Barcode value={printItem.id} displayValue height={50} width={1.5} margin={0} fontSize={14} background="transparent" />
          <div style={{ fontSize: "15px", fontWeight: "bold" }}>Rp {printItem.price.toLocaleString("id-ID")}</div>
          {printItem.size && <div style={{ fontSize: "11px", marginTop: "3px" }}>Size: {printItem.size}</div>}
        </div>
      )}
    </div>
  );
}