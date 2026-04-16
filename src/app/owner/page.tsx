"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function OwnerDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const [metrics, setMetrics] = useState({ gross: 0, itemsSold: 0 });
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
      .in("action", ["VOID_ITEM", "VOID_CART_ITEM", "CART_CLEAR"])
      .order("timestamp", { ascending: false }).limit(5);

    if (eventId !== "all") txnQuery = txnQuery.eq("event_id", eventId);

    const [txns, voids] = await Promise.all([txnQuery, voidQuery]);
    if (txns.data) {
      setRecentTxns(txns.data);
      const gross = txns.data.reduce((sum, t) => sum + Number(t.total_amount), 0);
      setMetrics({ gross, itemsSold: txns.data.length });
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
        minHeight: "90px",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--color-brand-accent)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--color-brand-border)")}
    >
      <span style={{ fontSize: "1.6rem" }}>{icon}</span>
      <span style={{ fontWeight: "bold", fontSize: "0.8rem", textAlign: "center", lineHeight: 1.2 }}>{title}</span>
    </button>
  );

  return (
    <div className="wnp-page">
      {/* Header */}
      <header className="wnp-header">
        <div>
          <h1 style={{ fontSize: "1.2rem", fontWeight: "bold", color: "var(--color-brand-text)" }}>
            👑 Owner Dashboard
          </h1>
          <p style={{ color: "var(--color-brand-muted)", fontSize: "0.75rem" }}>
            @{user.username} ({user.role})
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={selectedEventId}
            onChange={(e) => fetchDashboardData(e.target.value)}
            className="wnp-input"
            style={{ padding: "0.45rem 0.75rem", fontSize: "0.85rem", maxWidth: "180px" }}
          >
            <option value="all">Semua Penjualan</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
          <ThemeToggle />
          <button
            onClick={() => { logout(); router.replace("/login"); }}
            className="wnp-btn wnp-btn-danger"
            style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}
          >
            Keluar
          </button>
        </div>
      </header>

      <div className="wnp-page-content">

        {/* Gross Volume */}
        <div style={{
          background: "linear-gradient(135deg, var(--color-brand-card), var(--color-brand-surface))",
          padding: "1.5rem 2rem",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--color-brand-border)",
        }}>
          <p style={{ color: "var(--color-brand-muted)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>
            Gross Volume (Total)
          </p>
          <h2 style={{ fontSize: "clamp(2rem, 6vw, 3rem)", fontWeight: "bold", color: "var(--color-brand-green)" }}>
            Rp {metrics.gross.toLocaleString("id-ID")}
          </h2>
        </div>

        {/* Navigation Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <h3 style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              🚀 Operasional &amp; Laporan
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "0.75rem" }}>
              <NavButton title="Semua Transaksi" path="/owner/transactions" icon="📋" />
              <NavButton title="Events" path="/owner/events" icon="📅" />
              <NavButton title="Settlement" path="/owner/settlement" icon="💰" />
              <NavButton title="Kode Diskon" path="/owner/discounts" icon="🏷️" />
              <NavButton title="Audit Log" path="/owner/audit" icon="🚨" />
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              🗄️ Master Data
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "0.75rem" }}>
              <NavButton title="Data Vendor" path="/owner/vendors" icon="🏢" />
              <NavButton title="Data Akun" path="/owner/users" icon="👥" />
              <NavButton title="Database Stok" path="/owner/stock" icon="📦" />
              <NavButton title="Generate SKU" path="/owner/generate" icon="🖨️" />
              <NavButton title="Scan &amp; Lookup" path="/owner/barcode" icon="📷" />
            </div>
          </div>
        </div>

        {/* Monitoring Panels */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.25rem" }}>

          {/* Recent Transactions */}
          <div className="wnp-card">
            <h3 style={{ fontSize: "1rem", marginBottom: "1rem", fontWeight: "bold" }}>
              📊 Riwayat Penjualan Terbaru
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {recentTxns.length === 0 && (
                <p style={{ color: "var(--color-brand-muted)", textAlign: "center", padding: "1rem" }}>Belum ada transaksi.</p>
              )}
              {recentTxns.map(t => (
                <div key={t.id} style={{ padding: "0.85rem", background: "var(--color-brand-surface)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <span style={{ fontWeight: "bold", display: "block" }}>Rp {Number(t.total_amount).toLocaleString("id-ID")}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)" }}>
                        {new Date(t.created_at).toLocaleTimeString("id-ID")} • {t.cashier_name}
                      </span>
                    </div>
                    <span className={`wnp-badge ${t.payment_method === "CASH" ? "wnp-badge-green" : "wnp-badge-purple"}`}>
                      {t.payment_method}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", borderTop: "1px dashed var(--color-brand-border)", paddingTop: "0.5rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <span style={{ color: "var(--color-brand-text)", fontWeight: "bold" }}>Item: </span>
                    {t.transaction_items?.length > 0
                      ? t.transaction_items.map((ti: any) => ti.items?.name || "Unknown").join(", ")
                      : "Tidak ada detail"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Void Tracker */}
          <div style={{ background: "rgba(239,68,68,0.04)", padding: "1.25rem", borderRadius: "var(--radius-xl)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <h3 style={{ fontSize: "1rem", color: "var(--color-brand-red)", marginBottom: "1rem", fontWeight: "bold" }}>
              Live Void Tracker 🚨
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {voidLogs.length === 0
                ? <p style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem" }}>Tidak ada void terbaru.</p>
                : voidLogs.map(v => (
                  <div key={v.id} style={{ background: "var(--color-brand-surface)", padding: "0.75rem", borderRadius: "8px", borderLeft: "4px solid var(--color-brand-red)" }}>
                    <div style={{ fontWeight: "bold", fontSize: "0.85rem" }}>{v.item_id || "CART CLEAR"}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", marginTop: "0.15rem" }}>Oleh: {v.cashier_name}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Tablet+ monitoring: side by side */}
        <style>{`@media(min-width:768px){.owner-monitor-grid{grid-template-columns:2fr 1fr!important;}}`}</style>
      </div>
    </div>
  );
}