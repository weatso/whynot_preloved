"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useCartStore } from "@/lib/store";
import OfflineIndicator from "@/components/OfflineIndicator";
import { ThemeToggle } from "@/components/ThemeToggle";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Eye, EyeOff } from "lucide-react";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), { ssr: false });
import Receipt from "@/components/Receipt";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

export default function KasirPage() {
  const router = useRouter();
  const { user, logout, tenantBranding } = useAuthStore();
  const {
    items, eventSession, appliedDiscount,
    setEventSession, addItem, voidCartItem, clearCart,
    applyDiscountCode, clearDiscount, submitTransaction,
    syncItemCache, cachedItems, retryPending,
  } = useCartStore();

  const isMobile = useIsMobile();

  const [activeEvents, setActiveEvents] = useState<{ id: string; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [discountInput, setDiscountInput] = useState("");
  const [scanMessage, setScanMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [activeTab, setActiveTab] = useState<"scan" | "cart">("scan");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [waNumber, setWaNumber] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [showReauthPassword, setShowReauthPassword] = useState(false);
  const [reauthError, setReauthError] = useState("");
  const [mounted, setMounted] = useState(false);

  const subtotal = items.reduce((sum, i) => sum + i.price, 0);
  const discountAmount = appliedDiscount ? Math.round(subtotal * (appliedDiscount.pct / 100)) : 0;
  const grandTotal = subtotal - discountAmount;

  const fetchEvents = async () => {
    const { data } = await supabase.from("events").select("id, name").eq("is_active", true);
    if (data) setActiveEvents(data);
  };

  useEffect(() => {
    setMounted(true);
    if (!user) { router.replace("/login"); return; }
    if (user.role === "superadmin") { router.replace("/superadmin"); return; }
    if (user.role === "owner" || user.role === "admin") { router.replace("/owner"); return; }
    fetchEvents(); syncItemCache();

    // Check session every minute
    const checkSession = () => {
      const token = useAuthStore.getState().token;
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.exp * 1000 < Date.now()) {
            setSessionExpired(true);
          }
        } catch (e) {
          setSessionExpired(true);
        }
      }
    };
    const interval = setInterval(checkSession, 1000 * 60);
    return () => clearInterval(interval);
  }, [user, router, syncItemCache]);

  useEffect(() => {
    const interval = setInterval(() => retryPending(), 5000);
    return () => clearInterval(interval);
  }, [retryPending]);

  const handleReauth = async (e: React.FormEvent) => {
    e.preventDefault();
    setReauthError("");
    const { login } = useAuthStore.getState();
    const res = await login(user!.username, reauthPassword);
    if (res.success) {
      setSessionExpired(false);
      setReauthPassword("");
      setShowReauthPassword(false);
    } else {
      setReauthError("Password salah atau sesi tidak dapat diperbarui.");
    }
  };

  const formatLocalDate = (isoStr: string) => {
    return new Intl.DateTimeFormat("id-ID", {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: "Asia/Jakarta"
    }).format(new Date(isoStr));
  };

  // Global Focus Hijack untuk Physical Scanner
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen || showScanner) return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag !== "INPUT" && activeTag !== "TEXTAREA" && activeTag !== "SELECT") {
        if (e.key.length === 1 || e.key === "Enter") {
          inputRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isModalOpen, showScanner]);

  const handleScan = useCallback(async (rawId: string) => {
    const id = rawId.trim().toUpperCase();
    setInputValue("");
    setSearchResults([]);
    setScanMessage(null);
    if (!id || !user) return;
    if (items.find(i => i.id === id)) {
      setScanMessage({ text: `⚠️ ${id} sudah ada di keranjang`, type: "error" });
      return;
    }
    let item = cachedItems.find(i => i.id === id);
    if (!item) {
      try {
        const { data, error } = await supabase
          .from("items")
          .select("*, vendors(commission_rate_percentage)")
          .eq("id", id)
          .single();
        if (error) console.error("Fallback Fetch Error:", error);
        if (data) {
          item = { ...data, vendor_commission_rate: (data as any).vendors?.commission_rate_percentage || 0 } as any;
        }
      } catch (e) {
        console.error("Fallback Catch:", e);
      }
    }
    if (!item) { setScanMessage({ text: "❌ Barang tidak ditemukan", type: "error" }); return; }
    if (item.status !== "available") {
      setScanMessage({ text: `❌ ${item.name} sudah terjual / di keranjang lain`, type: "error" }); return;
    }
    const discountPct = item.discount_percentage || 0;
    const finalPrice = Math.round(item.price * (1 - discountPct / 100));
    addItem({ id: item.id, name: item.name, category: item.category, price: finalPrice, originalPrice: item.price, itemDiscountPct: discountPct, vendorId: item.vendor_id, vendorCommissionRate: item.vendor_commission_rate || 0 });
    supabase.from("items").update({ status: "in_cart" }).eq("id", item.id).then();
    setScanMessage({ text: `✓ ${item.name} ditambahkan`, type: "success" });
    if (isMobile) setActiveTab("cart");
    setTimeout(() => { setScanMessage(null); if (isMobile) setActiveTab("scan"); }, 2500);
  }, [items, cachedItems, addItem, user, isMobile]);

  if (!mounted || !user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "var(--color-brand-bg)" }}>
        <h2 style={{ color: "var(--color-brand-accent)", fontFamily: "var(--font-mono)" }}>Memuat POS Engine...</h2>
      </div>
    );
  }

  const handleSearchChange = (val: string) => {
    setInputValue(val);
    if (val.trim().length === 0) { setSearchResults([]); return; }
    const query = val.toLowerCase();
    const results = cachedItems.filter(i =>
      i.status === "available" &&
      (i.id.toLowerCase().includes(query) || i.name.toLowerCase().includes(query) ||
       i.category.toLowerCase().includes(query))
    ).slice(0, 8);
    setSearchResults(results);
  };

  const handleApplyDiscount = async () => {
    if (!discountInput.trim()) return;
    const { success, error } = await applyDiscountCode(discountInput);
    if (!success) alert(error);
    setDiscountInput("");
  };

  const handleFinalPayment = async (method: "CASH" | "QRIS") => {
    if (isProcessing || !user) return;
    setIsProcessing(true);
    const txnData = {
      items: [...items],
      subtotal,
      discount: appliedDiscount ? { code: appliedDiscount.code, amount: discountAmount } : null,
      total: grandTotal,
      paymentMethod: method,
      cashier: user.name,
      waNumber: waNumber.trim(),
      date: new Date().toISOString()
    };

    const { success, offline, txnId } = await submitTransaction(method, user.name, user.id, waNumber.trim() || null);
    
    setLastTransaction({ ...txnData, id: txnId || "OFFLINE" });
    setIsModalOpen(false);
    setIsProcessing(false);

    if (offline) {
      alert("⚠️ Offline: Transaksi disimpan & akan disinkronisasi otomatis.");
    } else {
      setShowSuccessModal(true);
    }
    setWaNumber("");
  };

  const scanBorderColor = scanMessage?.type === "error" ? "var(--color-brand-red)"
    : scanMessage?.type === "success" ? "var(--color-brand-green)"
    : "var(--color-brand-accent)";

  const ScanPanel = (
    <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem", overflow: "hidden", minWidth: 0 }}>
      <div style={{ background: "var(--color-brand-card)", padding: "1rem", borderRadius: "var(--radius-xl)", border: `2px solid ${scanBorderColor}`, position: "relative", transition: "border-color 0.3s", flexShrink: 0 }}>
        <p style={{ color: "var(--color-brand-muted)", fontSize: "0.7rem", textTransform: "uppercase", marginBottom: "0.5rem", fontWeight: "bold", letterSpacing: "0.05em" }}>
          Cari Nama / Scan Barcode
        </p>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            ref={inputRef} type="text" value={inputValue}
            onChange={e => handleSearchChange(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleScan(inputValue); }}
            placeholder="Ketik nama / ID barang..."
            style={{ flex: 1, background: "transparent", border: "none", fontSize: isMobile ? "1.1rem" : "1.5rem", color: "var(--color-brand-text)", outline: "none", fontWeight: "bold", fontFamily: "var(--font-mono)", minWidth: 0 }}
            autoComplete="off"
            autoFocus
          />
          <button
            onClick={() => setShowScanner(true)}
            title="Scan dengan kamera"
            style={{ background: "var(--color-brand-surface)", color: "var(--color-brand-accent-light)", border: "1px solid var(--color-brand-border)", padding: "0.5rem 0.7rem", borderRadius: "8px", cursor: "pointer", fontSize: "1.1rem", flexShrink: 0 }}
          >
            📷
          </button>
          <button
            onClick={() => handleScan(inputValue)}
            style={{ background: "var(--color-brand-accent)", color: "white", border: "none", padding: "0.5rem 0.85rem", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, fontSize: "0.9rem" }}
          >
            Tambah
          </button>
        </div>
        {searchResults.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", borderRadius: "0 0 12px 12px", zIndex: 50, maxHeight: "260px", overflowY: "auto", boxShadow: "0 10px 30px var(--color-brand-shadow)" }}>
            {searchResults.map(res => (
              <div key={res.id} onClick={() => handleScan(res.id)}
                style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--color-brand-border)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <div style={{ fontWeight: "bold", color: "var(--color-brand-text)", fontSize: "0.95rem" }}>{res.name}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--color-brand-muted)" }}>{res.category} • {res.id}</div>
                </div>
                <div style={{ color: "var(--color-brand-green)", fontWeight: "bold", whiteSpace: "nowrap", marginLeft: "1rem", fontSize: "0.9rem" }}>
                  Rp {res.price.toLocaleString("id-ID")}
                </div>
              </div>
            ))}
          </div>
        )}
        {scanMessage && (
          <p style={{ color: scanMessage.type === "error" ? "var(--color-brand-red)" : "var(--color-brand-green)", marginTop: "0.4rem", fontWeight: "bold", fontSize: "0.85rem" }}>
            {scanMessage.text}
          </p>
        )}
      </div>
      <div style={{ flex: 1, background: "var(--color-brand-card)", borderRadius: "var(--radius-xl)", overflowY: "auto", border: "1px solid var(--color-brand-border)" }}>
        {items.length === 0 ? (
          <div style={{ display: "flex", height: "100%", minHeight: "120px", alignItems: "center", justifyContent: "center", color: "var(--color-brand-muted)", flexDirection: "column", gap: "0.5rem" }}>
            <span style={{ fontSize: "2rem" }}>🛒</span>
            <span style={{ fontSize: "0.9rem" }}>Keranjang kosong</span>
          </div>
        ) : items.map(item => (
          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 1rem", borderBottom: "1px solid var(--color-brand-border)", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: "var(--color-brand-text)", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.95rem" }}>{item.name}</div>
              <div style={{ color: "var(--color-brand-muted)", fontSize: "0.7rem" }}>{item.id} • {item.category}</div>
              <div style={{ color: "var(--color-brand-green)", fontWeight: "bold", marginTop: "0.1rem", fontSize: "0.9rem" }}>
                Rp {item.price.toLocaleString("id-ID")}
                {item.itemDiscountPct > 0 && (
                  <span style={{ fontSize: "0.7rem", color: "var(--color-brand-muted)", marginLeft: "0.4rem", textDecoration: "line-through" }}>{item.originalPrice.toLocaleString("id-ID")}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => voidCartItem(item.id, user.name, user.id, "Dihapus dari kasir")}
              style={{ background: "rgba(239,68,68,0.1)", color: "var(--color-brand-red)", border: "none", padding: "0.4rem 0.7rem", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "0.9rem", flexShrink: 0 }}
            >✕</button>
          </div>
        ))}
      </div>
    </div>
  );

  const SummaryPanel = (
    <div style={{ width: isMobile ? "100%" : "300px", flexShrink: 0, background: "var(--color-brand-card)", borderLeft: isMobile ? "none" : "1px solid var(--color-brand-border)", padding: "1rem", display: "flex", flexDirection: "column", justifyContent: "space-between", overflowY: "auto" }}>
      <div>
        <h2 style={{ color: "var(--color-brand-muted)", textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.08em", marginBottom: "1rem", fontWeight: "bold" }}>Ringkasan</h2>
        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-brand-text)", marginBottom: "0.85rem", fontSize: "0.95rem" }}>
          <span>Subtotal ({items.length} item)</span>
          <span>Rp {subtotal.toLocaleString("id-ID")}</span>
        </div>
        <div style={{ marginBottom: "1rem", borderTop: "1px solid var(--color-brand-border)", paddingTop: "0.85rem" }}>
          {appliedDiscount ? (
            <div style={{ background: "rgba(16,185,129,0.08)", padding: "0.75rem", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(16,185,129,0.2)" }}>
              <div>
                <span style={{ color: "var(--color-brand-green)", fontWeight: "bold", display: "block", fontSize: "0.85rem" }}>Diskon {appliedDiscount.code} ({appliedDiscount.pct}%)</span>
                <span style={{ color: "var(--color-brand-green)", fontSize: "0.8rem" }}>- Rp {discountAmount.toLocaleString("id-ID")}</span>
              </div>
              <button onClick={clearDiscount} style={{ background: "none", border: "none", color: "var(--color-brand-red)", fontWeight: "bold", cursor: "pointer", fontSize: "1rem" }}>✕</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input type="text" value={discountInput} onChange={e => setDiscountInput(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === "Enter") handleApplyDiscount(); }} placeholder="Kode Diskon..." className="wnp-input" style={{ flex: 1, padding: "0.6rem 0.75rem" }} />
              <button onClick={handleApplyDiscount} className="wnp-btn wnp-btn-ghost" style={{ padding: "0.6rem 0.85rem", fontSize: "0.85rem" }}>Pakai</button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-brand-accent-light)", fontSize: "1.3rem", fontWeight: "bold", borderTop: "1px solid var(--color-brand-border)", paddingTop: "0.85rem", marginBottom: "0.85rem" }}>
          <span>TOTAL</span>
          <span>Rp {grandTotal.toLocaleString("id-ID")}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        <button
          onClick={() => { if (window.confirm("🚨 Kosongkan semua barang di keranjang?")) clearCart(user.name, user.id); }}
          disabled={items.length === 0}
          style={{ width: "100%", padding: "0.75rem", borderRadius: "10px", background: "transparent", color: "var(--color-brand-red)", border: "1px solid var(--color-brand-red)", fontWeight: "bold", cursor: items.length === 0 ? "not-allowed" : "pointer", opacity: items.length === 0 ? 0.4 : 1, fontSize: "0.9rem" }}
        >🗑️ Kosongkan</button>
        <button
          disabled={items.length === 0}
          onClick={() => setIsModalOpen(true)}
          style={{ width: "100%", padding: "1rem", borderRadius: "12px", background: items.length === 0 ? "var(--color-brand-surface)" : "var(--color-brand-green-dark)", color: items.length === 0 ? "var(--color-brand-muted)" : "white", fontSize: "1.2rem", fontWeight: "bold", border: "none", cursor: items.length === 0 ? "not-allowed" : "pointer", transition: "all 0.2s" }}
        >💳 BAYAR</button>
      </div>
    </div>
  );

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--color-brand-bg)", color: "var(--color-brand-text)", overflow: "hidden" }}>
      <header style={{
        padding: "0 1.25rem", background: "var(--color-brand-surface)",
        borderBottom: "1px solid var(--color-brand-border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: "0.75rem", flexShrink: 0, height: "60px",
        boxShadow: "0 1px 4px var(--color-brand-shadow)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexShrink: 0 }}>
          {tenantBranding?.logoUrl ? (
             <Image
              src={tenantBranding.logoUrl} alt="Logo" width={34} height={34}
              style={{ borderRadius: "8px", objectFit: "cover" }}
              priority
            />
          ) : (
            <div style={{ width: "34px", height: "34px", background: "var(--color-brand-accent)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
              {tenantBranding?.name?.charAt(0) || "W"}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--color-brand-text)", lineHeight: 1.1 }}>
              {tenantBranding?.name || "WNP POS"}
            </div>
            <div style={{ fontSize: "0.65rem", color: "var(--color-brand-muted)", lineHeight: 1 }}>
              Kasir: {user.name}
            </div>
          </div>
        </div>
        <select
          value={eventSession?.eventId || "daily"}
          onChange={e => {
            if (e.target.value === "daily")
              setEventSession({ eventId: null, eventName: "Penjualan Harian", saleType: "daily" });
            else
              setEventSession({ eventId: e.target.value, eventName: e.target.options[e.target.selectedIndex].text, saleType: "event" });
          }}
          style={{
            background: "var(--color-brand-bg)", color: "var(--color-brand-accent-light)",
            border: "1px solid var(--color-brand-accent)", padding: "0.35rem 0.6rem",
            borderRadius: "8px", outline: "none", fontWeight: "bold",
            fontSize: "0.8rem", maxWidth: isMobile ? "120px" : "200px",
            flex: "0 1 auto",
          }}
        >
          <option value="daily">{isMobile ? "Harian" : "— Penjualan Harian —"}</option>
          {activeEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexShrink: 0 }}>
          <OfflineIndicator />
          <ThemeToggle />
          <button
            onClick={() => { logout(); router.replace("/login"); }}
            style={{
              background: "transparent", border: "1px solid var(--color-brand-border)",
              padding: "0.35rem 0.6rem", borderRadius: "6px", color: "var(--color-brand-text)",
              cursor: "pointer", fontWeight: "bold", fontSize: "0.8rem",
            }}
          >
            {isMobile ? "↩" : "Keluar"}
          </button>
        </div>
      </header>
      {isMobile && (
        <div style={{ display: "flex", flexShrink: 0, background: "var(--color-brand-surface)", borderBottom: "1px solid var(--color-brand-border)" }}>
          <button onClick={() => setActiveTab("scan")} style={{ flex: 1, padding: "0.7rem", border: "none", cursor: "pointer", background: activeTab === "scan" ? "var(--color-brand-accent)" : "transparent", color: activeTab === "scan" ? "white" : "var(--color-brand-muted)", fontWeight: "bold", fontSize: "0.85rem" }}>🔍 Scan Barang</button>
          <button onClick={() => setActiveTab("cart")} style={{ flex: 1, padding: "0.7rem", border: "none", cursor: "pointer", background: activeTab === "cart" ? "var(--color-brand-accent)" : "transparent", color: activeTab === "cart" ? "white" : "var(--color-brand-muted)", fontWeight: "bold", fontSize: "0.85rem" }}>🛒 Keranjang {items.length > 0 && `(${items.length})`}</button>
        </div>
      )}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {isMobile ? (
          <>
            {activeTab === "scan" && ScanPanel}
            {activeTab === "cart" && SummaryPanel}
          </>
        ) : (
          <>
            {ScanPanel}
            {SummaryPanel}
          </>
        )}
      </div>
      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}>
          <div className="fade-in" style={{ background: "var(--color-brand-card)", border: "1px solid var(--color-brand-border)", borderRadius: "var(--radius-2xl)", padding: "2rem", width: "100%", maxWidth: "400px", textAlign: "center" }}>
            <h2 style={{ color: "var(--color-brand-text)", marginBottom: "0.5rem", fontSize: "1.2rem" }}>Pilih Pembayaran</h2>
            <div style={{ fontSize: "2.2rem", color: "var(--color-brand-green)", fontWeight: "bold", marginBottom: "1.25rem", fontFamily: "var(--font-mono)" }}>
              Rp {grandTotal.toLocaleString("id-ID")}
            </div>
            <div style={{ marginBottom: "1.25rem" }}>
              <input type="tel" value={waNumber} onChange={e => setWaNumber(e.target.value.replace(/\D/g, ""))} placeholder="Nomor WA Pelanggan (Opsional)" className="wnp-input" style={{ textAlign: "center", fontSize: "1rem" }} />
              <p style={{ color: "var(--color-brand-muted)", fontSize: "0.72rem", marginTop: "0.35rem" }}>Isi untuk kirim struk digital via WhatsApp</p>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <button disabled={isProcessing} onClick={() => handleFinalPayment("CASH")} style={{ flex: 1, padding: "1.1rem", background: "var(--color-brand-green)", border: "none", borderRadius: "12px", color: "white", fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer" }}>💵 CASH</button>
              <button disabled={isProcessing} onClick={() => handleFinalPayment("QRIS")} style={{ flex: 1, padding: "1.1rem", background: "var(--color-brand-accent)", border: "none", borderRadius: "12px", color: "white", fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer" }}>📱 QRIS</button>
            </div>
            <button disabled={isProcessing} onClick={() => setIsModalOpen(false)} style={{ width: "100%", padding: "0.75rem", background: "transparent", color: "var(--color-brand-muted)", border: "none", cursor: "pointer", fontWeight: "bold" }}>Batal</button>
          </div>
        </div>
      )}
      {showSuccessModal && lastTransaction && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "1rem" }}>
          <div className="fade-in" style={{ background: "var(--color-brand-card)", border: "1px solid var(--color-brand-border)", borderRadius: "var(--radius-2xl)", padding: "2.5rem", width: "100%", maxWidth: "420px", textAlign: "center" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>✅</div>
            <h2 style={{ fontSize: "1.8rem", fontWeight: "900", marginBottom: "0.5rem" }}>Transaksi Berhasil!</h2>
            <p style={{ color: "var(--color-brand-muted)", marginBottom: "2rem" }}>ID Transaksi: {lastTransaction.id.slice(0, 8).toUpperCase()}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button onClick={() => window.print()} style={{ width: "100%", padding: "1rem", background: "var(--color-brand-accent)", color: "white", border: "none", borderRadius: "12px", fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>🖨️ Cetak Struk</button>
              <button onClick={() => { const msg = `Halo! Terima kasih telah berbelanja di Why Not Preloved.%0A%0AID: ${lastTransaction.id.slice(0, 8).toUpperCase()}%0ATotal: Rp ${lastTransaction.total.toLocaleString("id-ID")}%0A%0ASystem powered by WEATSO.`; window.open(`https://wa.me/${lastTransaction.waNumber}?text=${msg}`, "_blank"); }} style={{ width: "100%", padding: "1rem", background: "var(--color-brand-green-dark)", color: "white", border: "none", borderRadius: "12px", fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>📱 Kirim Struk Digital (WA)</button>
              <button onClick={() => setShowSuccessModal(false)} style={{ width: "100%", padding: "1rem", background: "transparent", color: "var(--color-brand-muted)", border: "1px solid var(--color-brand-border)", borderRadius: "12px", fontWeight: "bold", cursor: "pointer", marginTop: "1rem" }}>Selesai / Transaksi Baru</button>
            </div>
          </div>
        </div>
      )}
      {lastTransaction && (
        <Receipt 
          id={lastTransaction.id} date={lastTransaction.date} cashier={lastTransaction.cashier} items={lastTransaction.items} subtotal={lastTransaction.subtotal} discount={lastTransaction.discount} total={lastTransaction.total} paymentMethod={lastTransaction.paymentMethod} branding={{ name: tenantBranding?.name || "WHY NOT PRELOVED", receiptFooter: tenantBranding?.receiptFooter || null }}
        />
      )}
      {showScanner && (
        <BarcodeScanner onScan={val => { handleScan(val); setShowScanner(false); }} onClose={() => setShowScanner(false)} />
      )}
      {sessionExpired && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
          <div className="fade-in" style={{ background: "#111", border: "1px solid #ef4444", borderRadius: "24px", padding: "2.5rem", width: "100%", maxWidth: "400px", textAlign: "center" }}>
            <div style={{ color: "#ef4444", marginBottom: "1rem" }}>⚠️</div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.5rem" }}>Sesi Berakhir</h2>
            <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: "2rem", fontSize: "0.9rem" }}>
              Sesi Anda telah habis demi keamanan. Masukkan Password untuk melanjutkan transaksi tanpa kehilangan keranjang.
            </p>
            <form onSubmit={handleReauth}>
              <div style={{ position: "relative", marginBottom: "1rem" }}>
                <input 
                  type={showReauthPassword ? "text" : "password"} 
                  placeholder="Masukkan Password" required
                  value={reauthPassword} onChange={e => setReauthPassword(e.target.value)}
                  style={{ 
                    width: "100%", 
                    background: "#050505", 
                    border: "1px solid rgba(255,255,255,0.1)", 
                    borderRadius: "12px", 
                    padding: "1rem", 
                    paddingRight: "3rem",
                    color: "white", 
                    textAlign: "center", 
                    fontSize: "1.2rem", 
                    letterSpacing: showReauthPassword ? "normal" : "0.1em" 
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowReauthPassword(!showReauthPassword)}
                  style={{
                    position: "absolute",
                    right: "1rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.4)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {showReauthPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {reauthError && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: "1rem" }}>{reauthError}</p>}
              <button 
                type="submit"
                style={{ width: "100%", background: "white", color: "black", border: "none", padding: "1rem", borderRadius: "12px", fontWeight: "bold", cursor: "pointer" }}
              >
                Lanjutkan Transaksi
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}