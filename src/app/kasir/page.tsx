"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useCartStore } from "@/lib/store";
import OfflineIndicator from "@/components/OfflineIndicator";
import { ThemeToggle } from "@/components/ThemeToggle";
import dynamic from "next/dynamic";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), { ssr: false });

export default function KasirPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const {
    items, eventSession, appliedDiscount,
    setEventSession, addItem, voidCartItem, clearCart,
    applyDiscountCode, clearDiscount, submitTransaction,
    syncItemCache, cachedItems, retryPending,
  } = useCartStore();

  const [activeEvents, setActiveEvents] = useState<{ id: string; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [discountInput, setDiscountInput] = useState("");
  const [scanMessage, setScanMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showCart, setShowCart] = useState(false); // Mobile: toggle keranjang

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [waNumber, setWaNumber] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const subtotal = items.reduce((sum, i) => sum + i.price, 0);
  const discountAmount = appliedDiscount ? Math.round(subtotal * (appliedDiscount.pct / 100)) : 0;
  const grandTotal = subtotal - discountAmount;

  useEffect(() => {
    if (!user || user.role === "admin") router.replace("/login");
    fetchEvents();
    syncItemCache();
  }, [user, router, syncItemCache]);

  useEffect(() => {
    const interval = setInterval(() => retryPending(), 5000);
    return () => clearInterval(interval);
  }, [retryPending]);

  const fetchEvents = async () => {
    const { data } = await supabase.from("events").select("id, name").eq("is_active", true);
    if (data) setActiveEvents(data);
  };

  const handleSearchChange = (val: string) => {
    setInputValue(val);
    if (val.trim().length === 0) { setSearchResults([]); return; }
    const query = val.toLowerCase();
    const results = cachedItems.filter(i =>
      i.status === "available" &&
      (i.id.toLowerCase().includes(query) || i.name.toLowerCase().includes(query) ||
       i.category.toLowerCase().includes(query) || (i.barcode && i.barcode.toLowerCase().includes(query)))
    ).slice(0, 8);
    setSearchResults(results);
  };

  const handleScan = useCallback(async (rawId: string) => {
    const id = rawId.trim().toUpperCase();
    if (!id || !user) return;
    setInputValue("");
    setSearchResults([]);
    setScanMessage(null);

    if (items.find((i) => i.id === id)) {
      setScanMessage({ text: `⚠️ ${id} sudah ada di keranjang`, type: "error" });
      return;
    }

    let item = cachedItems.find((i) => i.id === id || i.barcode === id);
    if (!item) {
      try {
        const { data } = await supabase.from("items").select("*").eq("id", id).single();
        if (data) item = data as any;
      } catch (e) {}
    }

    if (!item) { setScanMessage({ text: `❌ Barang tidak ditemukan`, type: "error" }); return; }
    if (item.status !== "available") {
      setScanMessage({ text: `❌ ${item.name} sudah terjual / di keranjang lain`, type: "error" }); return;
    }

    const discountPct = item.discount_percentage || 0;
    const finalPrice = Math.round(item.price * (1 - discountPct / 100));

    addItem({
      id: item.id, name: item.name, category: item.category,
      price: finalPrice, originalPrice: item.price,
      itemDiscountPct: discountPct, vendorId: item.vendor_id,
    });

    supabase.from("items").update({ status: "in_cart" }).eq("id", item.id).then();
    setScanMessage({ text: `✓ ${item.name} ditambahkan`, type: "success" });
    // On mobile, auto-show cart tab after successful scan
    setShowCart(true);
    setTimeout(() => { setScanMessage(null); setShowCart(false); }, 2500);
  }, [items, cachedItems, addItem, user]);

  const handleApplyDiscount = async () => {
    if (!discountInput.trim()) return;
    const { success, error } = await applyDiscountCode(discountInput);
    if (!success) alert(error);
    setDiscountInput("");
  };

  const handleFinalPayment = async (method: "CASH" | "QRIS") => {
    if (isProcessing || !user) return;
    setIsProcessing(true);
    const { success, offline } = await submitTransaction(method, user.name, user.id, waNumber.trim() || null);
    setIsModalOpen(false);
    setWaNumber("");
    setIsProcessing(false);
    if (offline) alert("⚠️ Offline: Transaksi disimpan & akan disinkronisasi otomatis.");
    else setScanMessage({ text: `✅ Transaksi berhasil!`, type: "success" });
    setTimeout(() => setScanMessage(null), 3000);
  };

  if (!user) return null;

  const scanBorderColor = scanMessage?.type === "error"
    ? "var(--color-brand-red)"
    : scanMessage?.type === "success"
    ? "var(--color-brand-green)"
    : "var(--color-brand-accent)";

  return (
    <div className="wnp-page" style={{ height: "100dvh", overflow: "hidden" }}>

      {/* ===== HEADER ===== */}
      <header className="wnp-header">
        <span style={{ fontWeight: 700, color: "var(--color-brand-accent-light)", fontSize: "1.1rem", flexShrink: 0 }}>
          🏷️ WNP POS
        </span>

        <select
          value={eventSession?.eventId || "daily"}
          onChange={(e) => {
            if (e.target.value === "daily")
              setEventSession({ eventId: null, eventName: "Penjualan Harian", saleType: "daily" });
            else
              setEventSession({ eventId: e.target.value, eventName: e.target.options[e.target.selectedIndex].text, saleType: "event" });
          }}
          className="wnp-input"
          style={{ maxWidth: "200px", padding: "0.45rem 0.8rem", fontSize: "0.85rem" }}
        >
          <option value="daily">-- Penjualan Harian --</option>
          {activeEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <OfflineIndicator />
          <ThemeToggle />
          <span style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem", display: "none" }}
            className="md:inline">👤 @{user.username}</span>
          <button
            onClick={() => { logout(); router.replace("/login"); }}
            className="wnp-btn wnp-btn-ghost"
            style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
          >
            Keluar
          </button>
        </div>
      </header>

      {/* ===== MOBILE TAB SWITCHER ===== */}
      <div style={{
        display: "flex",
        background: "var(--color-brand-surface)",
        borderBottom: "1px solid var(--color-brand-border)",
      }} className="md:hidden">
        <button
          onClick={() => setShowCart(false)}
          style={{
            flex: 1, padding: "0.75rem", border: "none", cursor: "pointer",
            background: !showCart ? "var(--color-brand-accent)" : "transparent",
            color: !showCart ? "white" : "var(--color-brand-muted)",
            fontWeight: "bold", fontSize: "0.9rem", transition: "all 0.2s",
          }}
        >
          🔍 Scan Barang
        </button>
        <button
          onClick={() => setShowCart(true)}
          style={{
            flex: 1, padding: "0.75rem", border: "none", cursor: "pointer",
            background: showCart ? "var(--color-brand-accent)" : "transparent",
            color: showCart ? "white" : "var(--color-brand-muted)",
            fontWeight: "bold", fontSize: "0.9rem", transition: "all 0.2s",
          }}
        >
          🛒 Keranjang {items.length > 0 && `(${items.length})`}
        </button>
      </div>

      {/* ===== MAIN BODY ===== */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ===== LEFT PANEL: SCAN + KERANJANG ===== */}
        <div
          style={{
            flex: 2,
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            padding: "1rem",
            overflow: "hidden",
          }}
          className={showCart ? "hidden md:flex" : "flex"}
        >
          {/* Scan Input */}
          <div
            style={{
              background: "var(--color-brand-card)",
              padding: "1.25rem",
              borderRadius: "var(--radius-xl)",
              border: `2px solid ${scanBorderColor}`,
              position: "relative",
              transition: "border-color 0.3s",
            }}
          >
            <p style={{ color: "var(--color-brand-muted)", fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "0.5rem", fontWeight: "bold", letterSpacing: "0.05em" }}>
              Cari Nama / Scan Barcode
            </p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleScan(inputValue); }}
                placeholder="Ketik nama / ID barang..."
                style={{
                  flex: 1, background: "transparent", border: "none",
                  fontSize: "clamp(1.2rem, 4vw, 1.8rem)", color: "var(--color-brand-text)",
                  outline: "none", fontWeight: "bold", fontFamily: "var(--font-mono)",
                }}
                autoComplete="off"
              />
              {/* Camera scan button */}
              <button
                onClick={() => setShowScanner(true)}
                title="Scan dengan kamera"
                style={{
                  background: "var(--color-brand-surface)",
                  color: "var(--color-brand-accent-light)",
                  border: "1px solid var(--color-brand-border)",
                  padding: "0.6rem 0.9rem",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "1.2rem",
                  flexShrink: 0,
                }}
              >
                📷
              </button>
              <button
                onClick={() => handleScan(inputValue)}
                style={{
                  background: "var(--color-brand-accent)", color: "white", border: "none",
                  padding: "0.6rem 1rem", borderRadius: "8px", fontWeight: "bold", cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Tambah
              </button>
            </div>

            {/* Dropdown results */}
            {searchResults.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0,
                background: "var(--color-brand-surface)",
                border: "1px solid var(--color-brand-border)",
                borderRadius: "0 0 12px 12px",
                zIndex: 50, maxHeight: "280px", overflowY: "auto",
                boxShadow: "0 10px 30px var(--color-brand-shadow)",
              }}>
                {searchResults.map(res => (
                  <div
                    key={res.id}
                    onClick={() => handleScan(res.id)}
                    style={{
                      padding: "0.85rem 1rem",
                      borderBottom: "1px solid var(--color-brand-border)",
                      cursor: "pointer", display: "flex",
                      justifyContent: "space-between", alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "bold", color: "var(--color-brand-text)" }}>{res.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)" }}>
                        {res.category} • {res.id}
                      </div>
                    </div>
                    <div style={{ color: "var(--color-brand-green)", fontWeight: "bold", whiteSpace: "nowrap", marginLeft: "1rem" }}>
                      Rp {res.price.toLocaleString("id-ID")}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {scanMessage && (
              <p style={{ color: scanMessage.type === "error" ? "var(--color-brand-red)" : "var(--color-brand-green)", marginTop: "0.5rem", fontWeight: "bold", fontSize: "0.9rem" }}>
                {scanMessage.text}
              </p>
            )}
          </div>

          {/* Keranjang Items */}
          <div style={{
            flex: 1, background: "var(--color-brand-card)",
            borderRadius: "var(--radius-xl)", overflowY: "auto",
            border: "1px solid var(--color-brand-border)",
          }}>
            {items.length === 0 ? (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "var(--color-brand-muted)", flexDirection: "column", gap: "0.5rem" }}>
                <span style={{ fontSize: "2.5rem" }}>🛒</span>
                <span>Keranjang kosong</span>
              </div>
            ) : items.map((item) => (
              <div key={item.id} style={{
                display: "flex", justifyContent: "space-between",
                padding: "0.85rem 1rem", borderBottom: "1px solid var(--color-brand-border)",
                alignItems: "center", gap: "0.75rem",
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "var(--color-brand-text)", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name}
                  </div>
                  <div style={{ color: "var(--color-brand-muted)", fontSize: "0.75rem" }}>
                    {item.id} • {item.category}
                  </div>
                  <div style={{ color: "var(--color-brand-green)", fontWeight: "bold", marginTop: "0.1rem" }}>
                    Rp {item.price.toLocaleString("id-ID")}
                    {item.itemDiscountPct > 0 && (
                      <span style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", marginLeft: "0.4rem", textDecoration: "line-through" }}>
                        {item.originalPrice.toLocaleString("id-ID")}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => voidCartItem(item.id, user.name, user.id, "Dihapus dari kasir")}
                  style={{
                    background: "rgba(239,68,68,0.1)", color: "var(--color-brand-red)", border: "none",
                    padding: "0.5rem 0.85rem", borderRadius: "8px", fontWeight: "bold", cursor: "pointer",
                    fontSize: "1rem", flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ===== RIGHT PANEL: SUMMARY ===== */}
        <div
          style={{
            width: "100%",
            maxWidth: "340px",
            background: "var(--color-brand-card)",
            borderLeft: "1px solid var(--color-brand-border)",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            overflowY: "auto",
          }}
          // On desktop: always show. On mobile: shown when showCart tab active
          className={showCart ? "flex w-full max-w-full" : "hidden md:flex"}
        >
          <div>
            <h2 style={{ color: "var(--color-brand-muted)", textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.08em", marginBottom: "1.25rem", fontWeight: "bold" }}>
              Ringkasan Transaksi
            </h2>

            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-brand-text)", marginBottom: "1rem" }}>
              <span>Subtotal ({items.length} item)</span>
              <span>Rp {subtotal.toLocaleString("id-ID")}</span>
            </div>

            {/* Discount */}
            <div style={{ marginBottom: "1.25rem", borderTop: "1px solid var(--color-brand-border)", paddingTop: "1rem" }}>
              {appliedDiscount ? (
                <div style={{ background: "rgba(16,185,129,0.08)", padding: "0.85rem", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <div>
                    <span style={{ color: "var(--color-brand-green)", fontWeight: "bold", display: "block", fontSize: "0.9rem" }}>
                      Diskon {appliedDiscount.code} ({appliedDiscount.pct}%)
                    </span>
                    <span style={{ color: "var(--color-brand-green)", fontSize: "0.85rem" }}>
                      - Rp {discountAmount.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <button onClick={clearDiscount} style={{ background: "none", border: "none", color: "var(--color-brand-red)", fontWeight: "bold", cursor: "pointer", fontSize: "1.1rem" }}>✕</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text" value={discountInput}
                    onChange={e => setDiscountInput(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === "Enter") handleApplyDiscount(); }}
                    placeholder="Kode Diskon..."
                    className="wnp-input"
                    style={{ flex: 1 }}
                  />
                  <button onClick={handleApplyDiscount} className="wnp-btn wnp-btn-ghost">Pakai</button>
                </div>
              )}
            </div>

            {/* Grand Total */}
            <div style={{
              display: "flex", justifyContent: "space-between",
              color: "var(--color-brand-accent-light)", fontSize: "1.5rem", fontWeight: "bold",
              borderTop: "1px solid var(--color-brand-border)", paddingTop: "1rem", marginBottom: "1rem",
            }}>
              <span>TOTAL</span>
              <span>Rp {grandTotal.toLocaleString("id-ID")}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <button
              onClick={() => { if (window.confirm("🚨 Kosongkan semua barang di keranjang?")) clearCart(user.name, user.id); }}
              disabled={items.length === 0}
              className="wnp-btn wnp-btn-danger"
              style={{ width: "100%" }}
            >
              🗑️ Kosongkan Keranjang
            </button>

            <button
              disabled={items.length === 0}
              onClick={() => setIsModalOpen(true)}
              style={{
                width: "100%", padding: "1.25rem", borderRadius: "12px",
                background: items.length === 0 ? "var(--color-brand-surface)" : "var(--color-brand-green-dark)",
                color: items.length === 0 ? "var(--color-brand-muted)" : "white",
                fontSize: "1.3rem", fontWeight: "bold", border: "none",
                cursor: items.length === 0 ? "not-allowed" : "pointer",
                transition: "all 0.2s",
              }}
            >
              💳 BAYAR
            </button>
          </div>
        </div>
      </div>

      {/* ===== MODAL PEMBAYARAN ===== */}
      {isModalOpen && (
        <div className="wnp-modal-overlay">
          <div className="wnp-modal fade-in" style={{ textAlign: "center" }}>
            <h2 style={{ color: "var(--color-brand-text)", marginBottom: "0.5rem", fontSize: "1.3rem" }}>Pilih Pembayaran</h2>
            <div style={{ fontSize: "2.5rem", color: "var(--color-brand-green)", fontWeight: "bold", marginBottom: "1.5rem", fontFamily: "var(--font-mono)" }}>
              Rp {grandTotal.toLocaleString("id-ID")}
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <input
                type="tel" value={waNumber}
                onChange={e => setWaNumber(e.target.value.replace(/\D/g, ""))}
                placeholder="Nomor WA Pelanggan (Opsional)"
                className="wnp-input"
                style={{ textAlign: "center", fontSize: "1rem" }}
              />
              <p style={{ color: "var(--color-brand-muted)", fontSize: "0.75rem", marginTop: "0.4rem" }}>
                Isi untuk kirim struk digital via WhatsApp
              </p>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
              <button
                disabled={isProcessing}
                onClick={() => handleFinalPayment("CASH")}
                style={{ flex: 1, padding: "1.25rem", background: "var(--color-brand-green)", border: "none", borderRadius: "12px", color: "white", fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer" }}
              >
                💵 CASH
              </button>
              <button
                disabled={isProcessing}
                onClick={() => handleFinalPayment("QRIS")}
                style={{ flex: 1, padding: "1.25rem", background: "var(--color-brand-accent)", border: "none", borderRadius: "12px", color: "white", fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer" }}
              >
                📱 QRIS
              </button>
            </div>

            <button disabled={isProcessing} onClick={() => setIsModalOpen(false)} className="wnp-btn" style={{ background: "transparent", color: "var(--color-brand-muted)", width: "100%" }}>
              Batal
            </button>
          </div>
        </div>
      )}

      {/* ===== CAMERA SCANNER MODAL ===== */}
      {showScanner && (
        <BarcodeScanner
          onScan={(val) => handleScan(val)}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}