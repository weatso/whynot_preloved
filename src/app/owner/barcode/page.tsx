"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import Barcode from "react-barcode";
import dynamic from "next/dynamic";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), { ssr: false });

export default function BarcodeLookupPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [showScanner, setShowScanner] = useState(false);
  const [search, setSearch] = useState("");
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "owner") router.replace("/login");
  }, [user, router]);

  const lookupItem = async (query: string) => {
    const id = query.trim().toUpperCase();
    if (!id) return;
    setLoading(true);
    setItem(null);
    setNotFound(false);

    // Try by ID first, then by barcode
    let { data } = await supabase.from("items").select("*, vendors(name, code, commission_rate_percentage)").eq("id", id).single();
    if (!data) {
      const res = await supabase.from("items").select("*, vendors(name, code, commission_rate_percentage)").eq("barcode", id).single();
      data = res.data;
    }

    if (data) setItem(data);
    else setNotFound(true);
    setLoading(false);
  };

  const statusInfo = (status: string) => {
    if (status === "available") return { label: "Tersedia", class: "wnp-badge-green" };
    if (status === "sold") return { label: "Terjual", class: "wnp-badge-gray" };
    if (status === "in_cart") return { label: "Di Keranjang", class: "wnp-badge-yellow" };
    return { label: status, class: "wnp-badge-red" };
  };

  if (!user) return null;

  return (
    <div className="wnp-page">
      <PageHeader title="📷 Scan &amp; Lookup Barang" />

      <div className="wnp-page-content">
        {/* Search bar */}
        <div className="wnp-card" style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text" placeholder="Ketik ID atau scan barcode..."
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") lookupItem(search); }}
            className="wnp-input" style={{ flex: "1 1 200px" }}
          />
          <button onClick={() => setShowScanner(true)} className="wnp-btn wnp-btn-primary" style={{ flexShrink: 0 }}>
            📷 Scan Kamera
          </button>
          <button onClick={() => lookupItem(search)} className="wnp-btn wnp-btn-ghost" style={{ flexShrink: 0 }}>
            🔍 Cari
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-brand-muted)" }}>
            Mencari barang...
          </div>
        )}

        {/* Not Found */}
        {notFound && (
          <div className="wnp-card" style={{ textAlign: "center", padding: "2rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🔍</div>
            <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>Barang tidak ditemukan</h3>
            <p style={{ color: "var(--color-brand-muted)", fontSize: "0.9rem" }}>
              ID atau barcode &quot;{search}&quot; tidak ada di database.
            </p>
          </div>
        )}

        {/* Result */}
        {item && (
          <div className="wnp-card fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* Header with barcode */}
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
              {/* Barcode visual */}
              <div style={{
                background: "white", padding: "1rem", borderRadius: "8px",
                display: "flex", flexDirection: "column", alignItems: "center",
                flexShrink: 0,
              }}>
                <div style={{ fontSize: "0.65rem", fontWeight: "bold", color: "black", textTransform: "uppercase", marginBottom: "3px" }}>
                  WNP PRELOVED
                </div>
                <Barcode value={item.id} displayValue height={55} width={1.8} margin={0} fontSize={14} background="transparent" />
              </div>

              {/* Item info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: "clamp(1.2rem, 4vw, 1.6rem)", fontWeight: "bold", marginBottom: "0.5rem" }}>
                  {item.name}
                </h2>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                  <span className={`wnp-badge ${statusInfo(item.status).class}`}>{statusInfo(item.status).label}</span>
                  <span className="wnp-badge wnp-badge-purple">{item.category}</span>
                  {item.size && <span className="wnp-badge wnp-badge-gray">Size: {item.size}</span>}
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "var(--color-brand-green)", fontFamily: "var(--font-mono)" }}>
                  Rp {item.price.toLocaleString("id-ID")}
                </div>
                {item.discount_percentage > 0 && (
                  <div style={{ color: "var(--color-brand-yellow)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
                    Diskon bawaan: {item.discount_percentage}%
                  </div>
                )}
              </div>
            </div>

            {/* Detail Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
              <div style={{ background: "var(--color-brand-surface)", padding: "1rem", borderRadius: "8px" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", textTransform: "uppercase" }}>ID Barang</p>
                <p style={{ fontFamily: "var(--font-mono)", fontWeight: "bold", fontSize: "1.1rem" }}>{item.id}</p>
              </div>
              <div style={{ background: "var(--color-brand-surface)", padding: "1rem", borderRadius: "8px" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", textTransform: "uppercase" }}>Vendor</p>
                <p style={{ fontWeight: "bold" }}>
                  {item.vendors?.name || "—"}
                  {item.vendors?.code && <span style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem" }}> ({item.vendors.code})</span>}
                </p>
              </div>
              <div style={{ background: "var(--color-brand-surface)", padding: "1rem", borderRadius: "8px" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", textTransform: "uppercase" }}>Komisi</p>
                <p style={{ fontWeight: "bold" }}>
                  {item.vendors?.commission_rate_percentage ? `${item.vendors.commission_rate_percentage}%` : "—"}
                </p>
              </div>
              <div style={{ background: "var(--color-brand-surface)", padding: "1rem", borderRadius: "8px" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", textTransform: "uppercase" }}>Tanggal Masuk</p>
                <p style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
                  {item.created_at ? new Date(item.created_at).toLocaleDateString("id-ID") : "—"}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                onClick={() => router.push("/owner/stock")}
                className="wnp-btn wnp-btn-ghost"
              >
                📦 Buka Database Stok
              </button>
              <button
                onClick={() => { setItem(null); setSearch(""); }}
                className="wnp-btn wnp-btn-ghost"
              >
                🔍 Scan Lagi
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Camera Scanner */}
      {showScanner && (
        <BarcodeScanner
          onScan={(val) => { setSearch(val); setShowScanner(false); lookupItem(val); }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
