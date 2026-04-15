"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useCartStore } from "@/lib/store";
import OfflineIndicator from "@/components/OfflineIndicator";

export default function KasirPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { items, eventSession, appliedDiscount, setEventSession, addItem, voidCartItem, clearCart, applyDiscountCode, clearDiscount, submitTransaction, syncItemCache, cachedItems, retryPending } = useCartStore();

  const [activeEvents, setActiveEvents] = useState<{ id: string; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  
  const [scanMessage, setScanMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [waNumber, setWaNumber] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<"CASH" | "QRIS" | null>(null);
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

  // Autofocus Scanner
  useEffect(() => {
    if (!isModalOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [items, isModalOpen]);

  const fetchEvents = async () => {
    const { data } = await supabase.from("events").select("id, name").eq("is_active", true);
    if (data) setActiveEvents(data);
  };

  const handleScan = useCallback(async (rawId: string) => {
    const id = rawId.trim().toUpperCase();
    if (!id || !user) return;
    setInputValue("");
    setScanMessage(null);

    if (items.find((i) => i.id === id)) {
      setScanMessage({ text: `⚠️ ${id} sudah ada di keranjang`, type: "error" });
      return;
    }

    // OFFLINE-FIRST: Cari di cache lokal dulu
    let item = cachedItems.find((i) => i.id === id);
    
    // Jika tidak ada di lokal, coba paksa tembak server (siapa tahu item baru)
    if (!item) {
      try {
        const { data } = await supabase.from("items").select("*").eq("id", id).single();
        if (data) item = data as any;
      } catch (e) { /* ignore */ }
    }

    if (!item) {
      setScanMessage({ text: `❌ ID ${id} tidak ditemukan`, type: "error" });
      return;
    }
    if (item.status !== "available") {
      setScanMessage({ text: `❌ ${id} sudah terjual / tidak tersedia`, type: "error" });
      return;
    }

    const discountPct = item.discount_percentage || 0;
    const finalPrice = Math.round(item.price * (1 - discountPct / 100));

    addItem({
      id: item.id,
      name: item.name,
      category: item.category,
      price: finalPrice,
      originalPrice: item.price,
      itemDiscountPct: discountPct,
      vendorId: item.vendor_id
    });
    
    // Optimistic update lokal
    supabase.from("items").update({ status: "in_cart" }).eq("id", id).then();
    setScanMessage({ text: `✓ ${item.name} ditambahkan`, type: "success" });
    setTimeout(() => setScanMessage(null), 2000);
  }, [items, cachedItems, addItem, user]);

  const handleApplyDiscount = async () => {
    if (!discountInput.trim()) return;
    const { success, error } = await applyDiscountCode(discountInput);
    if (!success) alert(error);
    setDiscountInput("");
  };

  const handleFinalPayment = async () => {
    if (isProcessing || !user || !selectedPayment) return;
    setIsProcessing(true);

    const { success, offline } = await submitTransaction(selectedPayment, user.name, user.id, waNumber || null);

    setIsModalOpen(false);
    setSelectedPayment(null);
    setWaNumber("");
    setIsProcessing(false);

    if (offline) alert("⚠️ Offline: Transaksi disimpan & akan disinkronisasi otomatis.");
    else setScanMessage({ text: `✅ Transaksi berhasil!`, type: "success" });
    
    setTimeout(() => setScanMessage(null), 3000);
  };

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-brand-bg)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{ background: "var(--color-brand-surface)", borderBottom: "1px solid var(--color-brand-border)", padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <span style={{ fontWeight: "700", color: "var(--color-brand-text)", fontSize: "1.2rem" }}>🏷️ WNP POS Terminal</span>
        </div>
        
        {/* EVENT SELECTOR (WAJIB) */}
        <select 
          value={eventSession?.eventId || "daily"}
          onChange={(e) => {
            if (e.target.value === "daily") setEventSession({ eventId: null, eventName: "Penjualan Harian", saleType: "daily" });
            else setEventSession({ eventId: e.target.value, eventName: e.target.options[e.target.selectedIndex].text, saleType: "event" });
          }}
          style={{ background: "var(--color-brand-bg)", color: "var(--color-brand-accent-light)", border: "1px solid var(--color-brand-accent)", padding: "0.5rem 1rem", borderRadius: "8px", outline: "none", fontWeight: "bold" }}
        >
          <option value="daily">-- Penjualan Harian --</option>
          {activeEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>

        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <OfflineIndicator />
          <span style={{ color: "var(--color-brand-muted)", fontSize: "0.9rem" }}>👤 @{user.username}</span>
          <button onClick={() => { logout(); router.replace("/login"); }} style={{ background: "transparent", border: "1px solid var(--color-brand-border)", padding: "0.4rem 0.8rem", borderRadius: "6px", color: "white", cursor: "pointer" }}>Keluar</button>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", padding: "1rem", gap: "1rem", overflow: "hidden" }}>
        
        {/* KIRI: Input Scanner & Keranjang */}
        <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Scanner */}
          <div style={{ background: "var(--color-brand-card)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: `2px solid ${scanMessage?.type === "error" ? "var(--color-brand-red)" : scanMessage?.type === "success" ? "var(--color-brand-green)" : "var(--color-brand-accent)"}` }}>
            <p style={{ color: "var(--color-brand-muted)", fontSize: "0.8rem", textTransform: "uppercase", marginBottom: "0.5rem", fontWeight: "bold" }}>Scan / Ketik Barcode</p>
            <input 
              ref={inputRef} type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") handleScan(inputValue); }}
              placeholder="PRL-..."
              style={{ width: "100%", background: "transparent", border: "none", fontSize: "2rem", color: "white", outline: "none", fontWeight: "bold", fontFamily: "var(--font-mono)" }} 
            />
            {scanMessage && <p style={{ color: scanMessage.type === "error" ? "var(--color-brand-red)" : "var(--color-brand-green)", marginTop: "0.5rem", fontWeight: "bold" }}>{scanMessage.text}</p>}
          </div>

          {/* Cart List */}
          <div style={{ flex: 1, background: "var(--color-brand-card)", borderRadius: "var(--radius-xl)", overflowY: "auto", border: "1px solid var(--color-brand-border)" }}>
            {items.length === 0 ? (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "var(--color-brand-muted)" }}>Keranjang Kosong</div>
            ) : (
              items.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "1rem", borderBottom: "1px solid var(--color-brand-border)", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "white", fontWeight: "bold" }}>{item.name} <span style={{ color: "var(--color-brand-muted)", fontSize: "0.8rem" }}>({item.id})</span></div>
                    <div style={{ color: "var(--color-brand-green)", fontWeight: "bold", marginTop: "0.2rem" }}>Rp {item.price.toLocaleString("id-ID")}</div>
                  </div>
                  <button onClick={() => voidCartItem(item.id, user.name, user.id, "Kasir membatalkan item")} style={{ background: "rgba(239,68,68,0.1)", color: "var(--color-brand-red)", border: "none", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>X</button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* KANAN: Checkout & Diskon */}
        <div style={{ flex: 1, background: "var(--color-brand-card)", borderRadius: "var(--radius-xl)", padding: "1.5rem", border: "1px solid var(--color-brand-border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ color: "var(--color-brand-muted)", textTransform: "uppercase", fontSize: "0.9rem", marginBottom: "1.5rem" }}>Ringkasan</h2>
            
            <div style={{ display: "flex", justifyContent: "space-between", color: "white", marginBottom: "1rem" }}>
              <span>Subtotal</span>
              <span>Rp {subtotal.toLocaleString("id-ID")}</span>
            </div>

            {/* KODE DISKON SECTION */}
            <div style={{ marginBottom: "1.5rem", borderTop: "1px solid var(--color-brand-border)", paddingTop: "1rem" }}>
              {appliedDiscount ? (
                <div style={{ background: "rgba(16,185,129,0.1)", padding: "1rem", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ color: "var(--color-brand-green)", fontWeight: "bold", display: "block" }}>Diskon {appliedDiscount.code} ({appliedDiscount.pct}%)</span>
                    <span style={{ color: "var(--color-brand-green)" }}>- Rp {discountAmount.toLocaleString("id-ID")}</span>
                  </div>
                  <button onClick={clearDiscount} style={{ background: "none", border: "none", color: "var(--color-brand-red)", fontWeight: "bold", cursor: "pointer", fontSize: "1.2rem" }}>X</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input type="text" value={discountInput} onChange={e => setDiscountInput(e.target.value)} placeholder="Masukkan Kode Diskon" style={{ flex: 1, padding: "0.8rem", borderRadius: "8px", background: "var(--color-brand-bg)", border: "1px solid var(--color-brand-border)", color: "white", outline: "none" }} />
                  <button onClick={handleApplyDiscount} style={{ padding: "0.8rem 1.2rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", cursor: "pointer" }}>Pakai</button>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-brand-accent-light)", fontSize: "1.5rem", fontWeight: "bold", borderTop: "1px solid var(--color-brand-border)", paddingTop: "1rem" }}>
              <span>TOTAL</span>
              <span>Rp {grandTotal.toLocaleString("id-ID")}</span>
            </div>
          </div>

          <button disabled={items.length === 0} onClick={() => setIsModalOpen(true)} style={{ width: "100%", padding: "1.5rem", borderRadius: "12px", background: items.length === 0 ? "var(--color-brand-surface)" : "var(--color-brand-green-dark)", color: "white", fontSize: "1.5rem", fontWeight: "bold", border: "none", cursor: items.length === 0 ? "not-allowed" : "pointer" }}>
            BAYAR
          </button>
        </div>
      </div>

      {/* Modal Pembayaran */}
      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "var(--color-brand-card)", padding: "2rem", borderRadius: "var(--radius-2xl)", width: "100%", maxWidth: "400px", textAlign: "center" }}>
            <h2 style={{ color: "white", marginBottom: "1.5rem" }}>Pilih Metode Pembayaran</h2>
            <div style={{ fontSize: "2.5rem", color: "var(--color-brand-green)", fontWeight: "bold", marginBottom: "2rem" }}>Rp {grandTotal.toLocaleString("id-ID")}</div>
            
            <div style={{ marginBottom: "1.5rem" }}>
              <input type="text" value={waNumber} onChange={e => setWaNumber(e.target.value.replace(/\D/g, ""))} placeholder="Nomor WA Pelanggan (Opsional)" style={{ width: "100%", padding: "1rem", borderRadius: "8px", background: "var(--color-brand-bg)", border: "1px solid var(--color-brand-border)", color: "white", outline: "none", textAlign: "center" }} />
            </div>

            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
              <button onClick={() => { setSelectedPayment("CASH"); handleFinalPayment(); }} style={{ flex: 1, padding: "1.5rem", background: "var(--color-brand-green)", border: "none", borderRadius: "12px", color: "white", fontSize: "1.2rem", fontWeight: "bold", cursor: "pointer" }}>CASH</button>
              <button onClick={() => { setSelectedPayment("QRIS"); handleFinalPayment(); }} style={{ flex: 1, padding: "1.5rem", background: "var(--color-brand-accent)", border: "none", borderRadius: "12px", color: "white", fontSize: "1.2rem", fontWeight: "bold", cursor: "pointer" }}>QRIS</button>
            </div>
            
            <button onClick={() => setIsModalOpen(false)} style={{ width: "100%", padding: "1rem", background: "transparent", color: "var(--color-brand-muted)", border: "none", cursor: "pointer" }}>Batal</button>
          </div>
        </div>
      )}
    </div>
  );
}