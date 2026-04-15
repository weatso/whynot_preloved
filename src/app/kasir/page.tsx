"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useCartStore } from "@/lib/store";
import { formatRupiah } from "@/lib/skuGenerator";
import OfflineIndicator from "@/components/OfflineIndicator";

type PaymentMethod = "CASH" | "QRIS";

export default function KasirPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { items, addItem, removeItem, clearCart, submitTransaction, retryPending } = useCartStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [waStep, setWaStep] = useState(false);
  const [waNumber, setWaNumber] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);

  const total = items.reduce((sum, i) => sum + i.price, 0);
  const totalDiscount = items.reduce((sum, i) => sum + (i.originalPrice - i.price), 0);

  // Auth guard
  useEffect(() => {
    if (!user) router.replace("/login");
    else if (user.role !== "kasir" && user.role !== "owner") router.replace("/login");
  }, [user, router]);

  // Always keep input focused
  useEffect(() => { if (!isModalOpen) inputRef.current?.focus(); }, [items, isModalOpen]);

  // Background retry on reconnect
  useEffect(() => {
    const interval = setInterval(() => retryPending(), 5000);
    return () => clearInterval(interval);
  }, [retryPending]);

  // Auto-clear messages
  useEffect(() => { if (scanError) { const t = setTimeout(() => setScanError(null), 3500); return () => clearTimeout(t); } }, [scanError]);
  useEffect(() => { if (scanSuccess) { const t = setTimeout(() => setScanSuccess(null), 2000); return () => clearTimeout(t); } }, [scanSuccess]);

  const handleScan = useCallback(async (rawId: string) => {
    const id = rawId.trim().toUpperCase();
    if (!id || !user) return;
    setInputValue("");
    setScanError(null);
    setScanSuccess(null);

    if (items.find((i) => i.id === id)) { setScanError(`⚠️ ${id} sudah ada di keranjang`); return; }

    const { data: item, error } = await supabase
      .from("items")
      .select("id, price, discount_percentage, status, vendor_id")
      .eq("id", id)
      .single();

    if (error || !item) { setScanError(`❌ ${id} tidak ditemukan`); return; }
    if (item.status !== "available") { setScanError(`❌ ${id} tidak tersedia (${item.status})`); return; }

    const discountPct = item.discount_percentage || 0;
    const finalPrice = Math.round(item.price * (1 - discountPct / 100));

    await supabase.from("items").update({ status: "in_cart" }).eq("id", id);
    addItem({ id: item.id, price: finalPrice, originalPrice: item.price, discountPercentage: discountPct, vendorId: item.vendor_id });

    if (discountPct > 0) {
      setScanSuccess(`✓ ${id} — Diskon ${discountPct}%! ${formatRupiah(item.price)} → ${formatRupiah(finalPrice)}`);
    } else {
      setScanSuccess(`✓ ${id} ditambahkan — ${formatRupiah(finalPrice)}`);
    }
  }, [items, addItem, user]);

  const handlePaymentSelect = (method: PaymentMethod) => {
    setSelectedPayment(method);
    setWaStep(true);
  };

  const handleFinalPayment = async () => {
    if (isProcessing || !user || !selectedPayment) return;
    setIsProcessing(true);
    setIsModalOpen(false);
    setWaStep(false);

    const success = await submitTransaction(selectedPayment, user.name, user.id, waNumber || undefined);

    if (waNumber && success) {
      await fetch("/api/send-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: waNumber, receiptData: { totalAmount: total, paymentMethod: selectedPayment } }),
      }).catch(() => {});
    }

    if (!success) {
      setScanError("⚠️ Offline — transaksi disimpan, akan sync saat online.");
    } else {
      setScanSuccess(`✅ Pembayaran ${selectedPayment} berhasil! ${formatRupiah(total)}`);
    }

    setWaNumber("");
    setSelectedPayment(null);
    setIsProcessing(false);
    inputRef.current?.focus();
  };

  const handleRemoveItem = async (id: string) => {
    if (!user) return;
    await removeItem(id, user.name, user.id);
  };

  const handleClearCart = async () => {
    if (!user) return;
    await clearCart(user.name, user.id, "Manual clear");
  };

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-brand-bg)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{ background: "var(--color-brand-surface)", borderBottom: "1px solid var(--color-brand-border)", padding: "0.875rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.25rem" }}>🏷️</span>
          <div>
            <span style={{ fontWeight: "700", color: "var(--color-brand-text)" }}>Vynalee POS</span>
            <span style={{ marginLeft: "0.6rem", fontSize: "0.7rem", color: "var(--color-brand-accent-light)", background: "rgba(124,58,237,0.2)", padding: "2px 8px", borderRadius: "20px", fontWeight: "600", textTransform: "uppercase" as const }}>KASIR</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <OfflineIndicator />
          <div style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)" }}>
            👤 <strong style={{ color: "var(--color-brand-text)" }}>{user.name}</strong>
          </div>
          <button id="btn-logout-kasir" onClick={() => { logout(); router.replace("/login"); }}
            style={{ background: "transparent", border: "1px solid var(--color-brand-border)", borderRadius: "8px", padding: "5px 12px", color: "var(--color-brand-muted)", cursor: "pointer", fontSize: "0.8rem", fontFamily: "var(--font-display)" }}>
            Keluar
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0.875rem", gap: "0.875rem", overflow: "hidden" }}>
        {/* Scanner Input */}
        <div style={{ background: "var(--color-brand-card)", border: `2px solid ${scanError ? "var(--color-brand-red)" : scanSuccess ? "var(--color-brand-green)" : "var(--color-brand-accent)"}`, borderRadius: "var(--radius-xl)", padding: "0.75rem 1.25rem", flexShrink: 0, transition: "border-color 0.2s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
            <span style={{ fontSize: "1.25rem" }}>📷</span>
            <span style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", textTransform: "uppercase" as const, letterSpacing: "0.1em", fontWeight: "600" }}>Scan / Ketik ID Barang</span>
            <span style={{ fontSize: "0.7rem", color: "var(--color-brand-accent-light)", marginLeft: "auto" }}>Enter untuk cari</span>
          </div>
          <input ref={inputRef} id="barcode-input" type="text" value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") handleScan(inputValue); }}
            placeholder="PRL-100K-001" autoComplete="off" spellCheck={false}
            style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: "2.25rem", fontWeight: "700", color: "var(--color-brand-text)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em", caretColor: "var(--color-brand-accent)" }} />
          {(scanError || scanSuccess) && (
            <div className="slide-in" style={{ marginTop: "0.4rem", padding: "6px 12px", borderRadius: "8px", background: scanError ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)", color: scanError ? "var(--color-brand-red)" : "var(--color-brand-green)", fontSize: "0.875rem", fontWeight: "600" }}>
              {scanError || scanSuccess}
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.875rem", overflow: "hidden" }}>
          {/* Cart */}
          <div style={{ flex: 1, background: "var(--color-brand-card)", border: "1px solid var(--color-brand-border)", borderRadius: "var(--radius-xl)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid var(--color-brand-border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <span style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: "600" }}>Keranjang</span>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <span style={{ background: "rgba(124,58,237,0.2)", color: "var(--color-brand-accent-light)", borderRadius: "20px", padding: "2px 10px", fontSize: "0.8rem", fontWeight: "700" }}>{items.length} item</span>
                {items.length > 0 && (
                  <button id="btn-clear-cart" onClick={handleClearCart}
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", padding: "3px 10px", color: "var(--color-brand-red)", cursor: "pointer", fontSize: "0.75rem", fontWeight: "600", fontFamily: "var(--font-display)" }}>
                    Kosongkan
                  </button>
                )}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0.625rem" }}>
              {items.length === 0 ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--color-brand-muted)", gap: "0.5rem" }}>
                  <span style={{ fontSize: "2.5rem", opacity: 0.3 }}>🛒</span>
                  <span style={{ fontSize: "0.875rem" }}>Scan barang untuk mulai</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {items.map((item) => (
                    <div key={item.id} className="slide-in" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", borderRadius: "10px", padding: "0.75rem 1rem" }}>
                      <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontWeight: "700", fontSize: "0.95rem", color: "var(--color-brand-text)", letterSpacing: "0.05em" }}>{item.id}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "2px" }}>
                          {item.discountPercentage > 0 && (
                            <span style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", textDecoration: "line-through" }}>{formatRupiah(item.originalPrice)}</span>
                          )}
                          <span style={{ fontSize: "1.1rem", fontWeight: "700", color: item.discountPercentage > 0 ? "var(--color-brand-yellow)" : "var(--color-brand-green)" }}>
                            {formatRupiah(item.price)}
                          </span>
                          {item.discountPercentage > 0 && (
                            <span style={{ fontSize: "0.7rem", background: "rgba(245,158,11,0.2)", color: "var(--color-brand-yellow)", borderRadius: "20px", padding: "1px 6px", fontWeight: "700" }}>
                              -{item.discountPercentage}%
                            </span>
                          )}
                        </div>
                      </div>
                      <button id={`btn-remove-${item.id}`} onClick={() => handleRemoveItem(item.id)}
                        style={{ width: "44px", height: "44px", borderRadius: "10px", background: "var(--color-brand-red)", border: "none", color: "white", fontSize: "1.1rem", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Checkout */}
          <div style={{ background: "var(--color-brand-card)", border: "1px solid var(--color-brand-border)", borderRadius: "var(--radius-xl)", padding: "1rem 1.25rem", flexShrink: 0 }}>
            {totalDiscount > 0 && (
              <div style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--color-brand-yellow)", marginBottom: "0.25rem" }}>
                Hemat {formatRupiah(totalDiscount)} 🎉
              </div>
            )}
            <div style={{ textAlign: "center", marginBottom: "0.875rem" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--color-brand-muted)", textTransform: "uppercase" as const, letterSpacing: "0.1em", fontWeight: "600", marginBottom: "4px" }}>Total Belanja</div>
              <div style={{ fontSize: "2.75rem", fontWeight: "700", color: total > 0 ? "var(--color-brand-green)" : "var(--color-brand-muted)", fontFamily: "var(--font-mono)", lineHeight: 1, letterSpacing: "-0.02em" }}>
                {formatRupiah(total)}
              </div>
            </div>
            <button id="btn-bayar" disabled={items.length === 0 || isProcessing} onClick={() => { setIsModalOpen(true); setWaStep(false); setSelectedPayment(null); }}
              style={{ width: "100%", padding: "1.375rem", borderRadius: "var(--radius-xl)", background: items.length === 0 ? "var(--color-brand-surface)" : "linear-gradient(135deg, var(--color-brand-green), var(--color-brand-green-dark))", border: "none", color: items.length === 0 ? "var(--color-brand-muted)" : "white", fontSize: "1.625rem", fontWeight: "800", cursor: items.length === 0 ? "not-allowed" : "pointer", fontFamily: "var(--font-display)", letterSpacing: "0.05em", boxShadow: items.length > 0 ? "0 8px 30px rgba(16,185,129,0.35)" : "none" }}>
              {isProcessing ? "⏳ MEMPROSES..." : "💰 BAYAR"}
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {isModalOpen && (
        <div className="fade-in" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" }} onClick={() => { setIsModalOpen(false); setWaStep(false); }}>
          <div className="slide-in" onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--color-brand-card)", border: "1px solid var(--color-brand-border)", borderRadius: "var(--radius-2xl) var(--radius-2xl) 0 0", padding: "2rem", width: "100%", maxWidth: "480px", boxShadow: "0 -20px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ width: "40px", height: "4px", background: "var(--color-brand-border)", borderRadius: "2px", margin: "0 auto 1.5rem" }} />

            {!waStep ? (
              <>
                <h2 style={{ textAlign: "center", fontSize: "1rem", color: "var(--color-brand-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: "600", marginBottom: "0.5rem" }}>Pilih Metode Bayar</h2>
                <div style={{ textAlign: "center", fontSize: "2.25rem", fontWeight: "700", color: "var(--color-brand-green)", marginBottom: "1.75rem", fontFamily: "var(--font-mono)" }}>{formatRupiah(total)}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  {(["CASH", "QRIS"] as PaymentMethod[]).map((m) => (
                    <button key={m} id={`btn-bayar-${m.toLowerCase()}`} onClick={() => handlePaymentSelect(m)}
                      style={{ padding: "1.75rem 1rem", borderRadius: "var(--radius-xl)", background: m === "CASH" ? "linear-gradient(135deg, var(--color-brand-green), var(--color-brand-green-dark))" : "linear-gradient(135deg, var(--color-brand-accent), #5b21b6)", border: "none", color: "white", fontSize: "1.4rem", fontWeight: "800", cursor: "pointer", fontFamily: "var(--font-display)", boxShadow: m === "CASH" ? "0 8px 25px rgba(16,185,129,0.35)" : "0 8px 25px rgba(124,58,237,0.35)" }}>
                      <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>{m === "CASH" ? "💵" : "📱"}</div>
                      {m}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 style={{ textAlign: "center", fontSize: "1rem", color: "var(--color-brand-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: "600", marginBottom: "0.5rem" }}>Struk WA (Opsional)</h2>
                <div style={{ textAlign: "center", fontSize: "0.9rem", color: "var(--color-brand-muted)", marginBottom: "1.25rem" }}>Masukkan nomor WA pelanggan untuk kirim struk digital</div>
                <div style={{ position: "relative", marginBottom: "1.25rem" }}>
                  <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--color-brand-muted)", fontSize: "1.1rem" }}>📱</span>
                  <input id="wa-number-input" type="tel" value={waNumber} onChange={(e) => setWaNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="628123456789" style={{ width: "100%", background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", borderRadius: "12px", padding: "1rem 1rem 1rem 3rem", color: "var(--color-brand-text)", fontSize: "1.1rem", fontFamily: "var(--font-mono)", outline: "none" }} />
                </div>
                <button id="btn-confirm-payment" onClick={handleFinalPayment}
                  style={{ width: "100%", padding: "1.25rem", borderRadius: "var(--radius-xl)", background: "linear-gradient(135deg, var(--color-brand-green), var(--color-brand-green-dark))", border: "none", color: "white", fontSize: "1.2rem", fontWeight: "800", cursor: "pointer", fontFamily: "var(--font-display)", marginBottom: "0.75rem", boxShadow: "0 8px 25px rgba(16,185,129,0.35)" }}>
                  ✅ KONFIRMASI BAYAR {selectedPayment}
                </button>
                <button id="btn-skip-wa" onClick={handleFinalPayment}
                  style={{ width: "100%", padding: "0.875rem", border: "1px solid var(--color-brand-border)", borderRadius: "var(--radius-xl)", background: "transparent", color: "var(--color-brand-muted)", cursor: "pointer", fontSize: "0.9rem", fontFamily: "var(--font-display)" }}>
                  Lewati (Tanpa Struk WA)
                </button>
              </>
            )}

            <button id="btn-cancel-payment" onClick={() => { setIsModalOpen(false); setWaStep(false); }}
              style={{ width: "100%", marginTop: "0.75rem", padding: "0.875rem", border: "1px solid var(--color-brand-border)", borderRadius: "var(--radius-xl)", background: "transparent", color: "var(--color-brand-muted)", cursor: "pointer", fontSize: "0.875rem", fontFamily: "var(--font-display)" }}>
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
