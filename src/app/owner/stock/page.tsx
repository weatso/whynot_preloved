"use client";
import { useState, useEffect, useRef } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || (user.role !== "owner" && user.role !== "admin")) router.replace("/login");
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
    else { setEditingItem(null); fetchStock(); inputRef.current?.focus(); }
  };

  const triggerPrint = (item: any) => {
    setPrintItem(item);
    setTimeout(() => window.print(), 100);
  };

  // Lookup barang dari searchbar (Enter atau tombol)
  const handleLookup = async () => {
    const q = search.trim().toUpperCase();
    if (!q) return;

    // Coba cari exact ID dulu
    let found = items.find(i => i.id === q);
    if (!found) {
      const { data } = await supabase.from("items").select("*, vendors(name)").eq("id", q).single();
      if (data) found = data;
    }
    // Kalau tidak ketemu exact, set sebagai filter biasa (sudah handle di filteredItems)
    if (found) setEditingItem(found);
  };

  const filteredItems = items.filter(i => {
    const matchStatus = statusFilter === "all" || i.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || i.id.toLowerCase().includes(q) || i.name.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const statusBadge = (s: string) => {
    if (s === "available") return { cls: "wnp-badge-green", label: "Available" };
    if (s === "sold") return { cls: "wnp-badge-gray", label: "Terjual" };
    if (s === "in_cart") return { cls: "wnp-badge-yellow", label: "Di Keranjang" };
    return { cls: "wnp-badge-red", label: s };
  };

  if (!user) return null;

  return (
    <div className="wnp-page">
      <PageHeader title="Database Stok &amp; Lookup" />

      <div className="wnp-page-content no-print">

        {/* ── SEARCHBAR TUNGGAL ── */}
        <div style={{
          display: "flex", gap: "0.5rem", alignItems: "center",
          background: "var(--color-brand-card)", padding: "0.85rem 1rem",
          borderRadius: "var(--radius-xl)", border: "2px solid var(--color-brand-accent)",
        }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Cari nama / ID barang, atau scan barcode…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleLookup(); }}
            autoFocus
            autoComplete="off"
            style={{
              flex: 1, background: "transparent", border: "none",
              color: "var(--color-brand-text)", outline: "none",
              fontSize: "1.05rem", fontFamily: "var(--font-mono)", fontWeight: "bold",
            }}
          />
          {/* Filter Status */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              background: "var(--color-brand-surface)", color: "var(--color-brand-muted)",
              border: "1px solid var(--color-brand-border)", borderRadius: "8px",
              padding: "0.45rem 0.6rem", fontSize: "0.82rem", outline: "none", flexShrink: 0,
            }}
          >
            <option value="all">Semua</option>
            <option value="available">Available</option>
            <option value="sold">Terjual</option>
            <option value="in_cart">Di Keranjang</option>
            <option value="void">Void</option>
          </select>
          {/* Tombol Enter/Lookup */}
          <button
            onClick={handleLookup}
            style={{
              background: "var(--color-brand-accent)", color: "white",
              border: "none", borderRadius: "8px", padding: "0.5rem 1rem",
              fontWeight: "bold", cursor: "pointer", fontSize: "0.9rem", flexShrink: 0,
            }}
          >
            🔍 Cari
          </button>
          {/* Tombol Kamera */}
          <button
            onClick={() => setShowScanner(true)}
            title="Scan barcode kamera"
            style={{
              background: "var(--color-brand-surface)",
              color: "var(--color-brand-accent-light)",
              border: "1px solid var(--color-brand-border)",
              borderRadius: "8px", padding: "0.5rem 0.75rem",
              cursor: "pointer", fontSize: "1.1rem", flexShrink: 0,
            }}
          >
            📷
          </button>
          <button
            onClick={fetchStock}
            style={{
              background: "transparent", color: "var(--color-brand-muted)",
              border: "1px solid var(--color-brand-border)", borderRadius: "8px",
              padding: "0.5rem 0.75rem", cursor: "pointer", fontSize: "0.85rem", flexShrink: 0,
            }}
          >
            🔄
          </button>
        </div>

        {/* Count info */}
        <div style={{ color: "var(--color-brand-muted)", fontSize: "0.82rem", paddingLeft: "0.25rem" }}>
          Menampilkan {filteredItems.length} dari {items.length} barang
        </div>

        {/* Tabel */}
        <div className="wnp-card" style={{ padding: 0, overflow: "hidden" }}>
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
                  <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--color-brand-muted)" }}>Memuat data…</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--color-brand-muted)" }}>Tidak ada barang ditemukan.</td></tr>
                ) : filteredItems.map(i => {
                  const badge = statusBadge(i.status);
                  return (
                    <tr key={i.id}>
                      <td style={{ fontFamily: "var(--font-mono)", fontWeight: "bold", fontSize: "0.85rem", whiteSpace: "nowrap" }}>{i.id}</td>
                      <td>
                        <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{i.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)" }}>{i.category}{i.size ? ` • ${i.size}` : ""}</div>
                      </td>
                      <td style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem" }}>{i.vendors?.name || "—"}</td>
                      <td style={{ fontWeight: "bold", color: "var(--color-brand-green)", whiteSpace: "nowrap" }}>Rp {i.price.toLocaleString("id-ID")}</td>
                      <td><span className={`wnp-badge ${badge.cls}`}>{badge.label}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button onClick={() => setEditingItem(i)} className="wnp-btn wnp-btn-ghost" style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }}>✏️</button>
                          <button onClick={() => triggerPrint(i)} className="wnp-btn wnp-btn-success" style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }}>🖨️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="wnp-modal-overlay no-print">
          <div className="wnp-modal fade-in">
            <h2 style={{ marginBottom: "0.35rem", fontSize: "1.1rem", fontWeight: "bold" }}>Edit Barang</h2>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.3rem", fontWeight: "bold", color: "var(--color-brand-accent-light)", marginBottom: "1.25rem" }}>
              {editingItem.id}
            </div>
            <form onSubmit={handleUpdateItem} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <input type="text" value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} placeholder="Nama Barang" className="wnp-input" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.3rem" }}>Harga (Rp)</label>
                  <input type="text" inputMode="numeric"
                    value={editingItem.price ? Number(String(editingItem.price).replace(/\D/g, "")).toLocaleString("id-ID") : ""}
                    onChange={e => {
                      const raw = e.target.value.replace(/\D/g, "").replace(/^0+/, "");
                      setEditingItem({ ...editingItem, price: raw });
                    }}
                    placeholder="Harga" className="wnp-input" />
                  <input type="text" value={editingItem.size || ""} onChange={e => setEditingItem({ ...editingItem, size: e.target.value })} placeholder="Ukuran" className="wnp-input" style={{ marginTop: "0.5rem" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.3rem" }}>Status Barang</label>
                  <select value={editingItem.status} onChange={e => setEditingItem({ ...editingItem, status: e.target.value })} className="wnp-input">
                    <option value="available">Tersedia (Available)</option>
                    <option value="in_cart">Di Keranjang (In Cart)</option>
                    <option value="sold">Terjual (Sold)</option>
                    <option value="void">Dibatalkan (Void)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
                <button type="submit" className="wnp-btn wnp-btn-primary" style={{ flex: 1 }}>Simpan</button>
                <button type="button" onClick={() => { setEditingItem(null); inputRef.current?.focus(); }} className="wnp-btn wnp-btn-ghost">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera Scanner */}
      {showScanner && (
        <BarcodeScanner
          onScan={(val) => { setSearch(val); setShowScanner(false); handleLookup(); }}
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
      ` }} />

      {printItem && (
        <div id="single-print-area" style={{ display: "none", width: "50mm", padding: "8px", color: "black", textAlign: "center" }}>
          <div style={{ fontSize: "11px", fontWeight: "bold" }}>WNP PRELOVED</div>
          <Barcode value={printItem.id} displayValue height={50} width={1.5} margin={0} fontSize={14} background="transparent" />
          <div style={{ fontSize: "15px", fontWeight: "bold" }}>Rp {printItem.price.toLocaleString("id-ID")}</div>
          {printItem.size && <div style={{ fontSize: "11px" }}>Size: {printItem.size}</div>}
        </div>
      )}
    </div>
  );
}