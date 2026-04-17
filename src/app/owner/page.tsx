"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";
import Image from "next/image";

export default function OwnerDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const [metrics, setMetrics] = useState({ gross: 0 });
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [voidLogs, setVoidLogs] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!user || user.role === "kasir") router.replace("/login");
    else { fetchEvents(); fetchDashboardData("all"); }
  }, [user, router]);

  const fetchEvents = async () => {
    const { data } = await supabase.from("events").select("id, name").order("created_at", { ascending: false });
    if (data) setEvents(data);
  };

  const fetchDashboardData = async (eventId: string) => {
    setSelectedEventId(eventId);
    let txnQuery = supabase.from("transactions").select(`
      id, total_amount, cashier_name, payment_method, created_at,
      transaction_items ( items ( id, name ) )
    `).order("created_at", { ascending: false }).limit(10);

    let voidQuery = supabase.from("audit_logs")
      .select("id, cashier_name, item_id, reason, timestamp")
      .in("action", ["VOID_ITEM", "VOID_CART_ITEM", "CART_CLEAR", "VOID_TRANSACTION"])
      .order("timestamp", { ascending: false }).limit(5);

    if (eventId !== "all") txnQuery = txnQuery.eq("event_id", eventId);

    const [txns, voids] = await Promise.all([txnQuery, voidQuery]);
    if (txns.data) {
      setRecentTxns(txns.data);
      const gross = txns.data.reduce((sum, t) => sum + Number(t.total_amount), 0);
      setMetrics({ gross });
    }
    if (voids.data) setVoidLogs(voids.data);
  };

  if (!user) return null;

  const NavButton = ({ title, path, icon }: { title: string; path: string; icon: string }) => (
    <button
      onClick={() => router.push(path)}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: "0.5rem", padding: "1rem 0.5rem",
        background: "var(--color-brand-surface)",
        border: "1px solid var(--color-brand-border)",
        borderRadius: "var(--radius-xl)", cursor: "pointer",
        color: "var(--color-brand-text)", transition: "all 0.2s",
        minHeight: "88px",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--color-brand-accent)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--color-brand-border)")}
    >
      <span style={{ fontSize: "1.5rem" }}>{icon}</span>
      <span style={{ fontWeight: "bold", fontSize: "0.78rem", textAlign: "center", lineHeight: 1.2 }}>{title}</span>
    </button>
  );

  return (
    <div className="wnp-page">
      {/* ===== HEADER ===== */}
      <header style={{
        padding: "0 1.25rem",
        background: "var(--color-brand-surface)",
        borderBottom: "1px solid var(--color-brand-border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: "0.75rem", position: "sticky", top: 0, zIndex: 10,
        boxShadow: "0 1px 4px var(--color-brand-shadow)",
        height: "60px", flexShrink: 0,
      }}>
        {/* Logo kiri */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
          <Image
            src="/logo.jpg"
            alt="Why Not Preloved"
            width={36}
            height={36}
            style={{ borderRadius: "8px", objectFit: "cover" }}
            priority
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--color-brand-text)", lineHeight: 1.1 }}>
              Why Not Preloved
            </div>
            <div style={{ fontSize: "0.68rem", color: "var(--color-brand-muted)", lineHeight: 1 }}>
              Owner Dashboard
            </div>
          </div>
        </div>

        {/* Controls kanan */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "nowrap" }}>
          <select
            value={selectedEventId}
            onChange={(e) => fetchDashboardData(e.target.value)}
            style={{
              background: "var(--color-brand-bg)", color: "var(--color-brand-text)",
              border: "1px solid var(--color-brand-border)", padding: "0.35rem 0.6rem",
              borderRadius: "8px", outline: "none", fontSize: "0.82rem", maxWidth: "160px",
            }}
          >
            <option value="all">Semua</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
          <ThemeToggle />
          <button
            onClick={() => { logout(); router.replace("/login"); }}
            style={{
              background: "transparent", border: "1px solid var(--color-brand-border)",
              color: "var(--color-brand-muted)", padding: "0.35rem 0.7rem",
              borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "0.82rem",
            }}
          >
            Keluar
          </button>
        </div>
      </header>

      <div className="wnp-page-content">

        {/* Gross Volume */}
        <div style={{
          background: "linear-gradient(135deg, var(--color-brand-card), var(--color-brand-surface))",
          padding: "1.5rem 2rem", borderRadius: "var(--radius-xl)",
          border: "1px solid var(--color-brand-border)",
        }}>
          <p style={{ color: "var(--color-brand-muted)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>
            Gross Volume {selectedEventId !== "all" ? `— ${events.find(e => e.id === selectedEventId)?.name || ""}` : "(Semua)"}
          </p>
          <h2 style={{ fontSize: "clamp(1.8rem, 6vw, 3rem)", fontWeight: "bold", color: "var(--color-brand-green)" }}>
            Rp {metrics.gross.toLocaleString("id-ID")}
          </h2>
        </div>

        {/* Navigation Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <h3 style={{ fontSize: "0.78rem", color: "var(--color-brand-muted)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Operasional &amp; Laporan
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "0.65rem" }}>
              <NavButton title="Semua Transaksi" path="/owner/transactions" icon="📋" />
              <NavButton title="Events" path="/owner/events" icon="📅" />
              <NavButton title="Settlement" path="/owner/settlement" icon="💰" />
              <NavButton title="Kode Diskon" path="/owner/discounts" icon="🏷️" />
              <NavButton title="Audit Log" path="/owner/audit" icon="🚨" />
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: "0.78rem", color: "var(--color-brand-muted)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Master Data
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "0.65rem" }}>
              <NavButton title="Data Vendor" path="/owner/vendors" icon="🏢" />
              <NavButton title="Data Akun" path="/owner/users" icon="👥" />
              <NavButton title="Database Stok" path="/owner/stock" icon="📦" />
              <NavButton title="Generate SKU" path="/owner/generate" icon="🖨️" />
            </div>
          </div>
        </div>

        {/* Monitoring */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Recent Transactions */}
          <div className="wnp-card">
            <h3 style={{ fontSize: "0.95rem", marginBottom: "1rem", fontWeight: "bold" }}>📊 Penjualan Terbaru</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {recentTxns.length === 0 && (
                <p style={{ color: "var(--color-brand-muted)", textAlign: "center", padding: "1rem", fontSize: "0.85rem" }}>Belum ada transaksi.</p>
              )}
              {recentTxns.map(t => (
                <div key={t.id} style={{ padding: "0.75rem", background: "var(--color-brand-surface)", borderRadius: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.4rem" }}>
                    <div>
                      <span style={{ fontWeight: "bold", fontSize: "0.95rem" }}>Rp {Number(t.total_amount).toLocaleString("id-ID")}</span>
                      <div style={{ fontSize: "0.73rem", color: "var(--color-brand-muted)" }}>
                        {new Date(t.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} • {t.cashier_name}
                      </div>
                    </div>
                    <span className={`wnp-badge ${t.payment_method === "CASH" ? "wnp-badge-green" : "wnp-badge-purple"}`}>
                      {t.payment_method}
                    </span>
                  </div>
                  {t.transaction_items?.length > 0 && (
                    <div style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", marginTop: "0.3rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.transaction_items.map((ti: any) => ti.items?.name || "?").join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Void Tracker */}
          <div style={{ background: "rgba(239,68,68,0.04)", padding: "1.25rem", borderRadius: "var(--radius-xl)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <h3 style={{ fontSize: "0.95rem", color: "var(--color-brand-red)", marginBottom: "0.85rem", fontWeight: "bold" }}>
              🚨 Void Tracker
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {voidLogs.length === 0
                ? <p style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem" }}>Tidak ada void terbaru.</p>
                : voidLogs.map(v => (
                  <div key={v.id} style={{ background: "var(--color-brand-surface)", padding: "0.65rem 0.85rem", borderRadius: "8px", borderLeft: "4px solid var(--color-brand-red)" }}>
                    <div style={{ fontWeight: "bold", fontSize: "0.85rem" }}>{v.item_id || "CART CLEAR"}</div>
                    <div style={{ fontSize: "0.73rem", color: "var(--color-brand-muted)", marginTop: "0.1rem" }}>Oleh: {v.cashier_name}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}