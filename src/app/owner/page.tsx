"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { supabase } from "@/lib/supabase";

export default function OwnerDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  
  const [metrics, setMetrics] = useState({ gross: 0, itemsSold: 0 });
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [voidLogs, setVoidLogs] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [events, setEvents] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    if (!user || user.role === "kasir") router.replace("/login");
    else {
      fetchEvents();
      fetchDashboardData("all");
    }
  }, [user, router]);

  const fetchEvents = async () => {
    const { data } = await supabase.from("events").select("id, name").order("created_at", { ascending: false });
    if (data) setEvents(data);
  };

  const fetchDashboardData = async (eventId: string) => {
    setSelectedEventId(eventId);
    
    // REVISI: Melakukan relasi (Join) ke tabel transaction_items dan items untuk menarik nama barang
    let txnQuery = supabase.from("transactions").select(`
      id, total_amount, cashier_name, payment_method, created_at,
      transaction_items ( items ( id, name ) )
    `).order("created_at", { ascending: false }).limit(10);
    
    let voidQuery = supabase.from("audit_logs").select("id, cashier_name, item_id, reason, timestamp").in("action", ["VOID_ITEM", "VOID_CART_ITEM", "CART_CLEAR"]).order("timestamp", { ascending: false }).limit(5);

    if (eventId !== "all") {
      txnQuery = txnQuery.eq("event_id", eventId);
    }

    const [txns, voids] = await Promise.all([txnQuery, voidQuery]);
    
    if (txns.data) {
      setRecentTxns(txns.data);
      const gross = txns.data.reduce((sum, t) => sum + Number(t.total_amount), 0);
      setMetrics({ gross, itemsSold: txns.data.length }); 
    }
    
    if (voids.data) setVoidLogs(voids.data);
  };

  if (!user) return null;

  const NavButton = ({ title, path, icon }: { title: string, path: string, icon: string }) => (
    <button onClick={() => router.push(path)} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "1.2rem", background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", borderRadius: "var(--radius-xl)", cursor: "pointer", color: "white", transition: "all 0.2s" }}>
      <span style={{ fontSize: "1.8rem" }}>{icon}</span>
      <span style={{ fontWeight: "bold", fontSize: "0.85rem" }}>{title}</span>
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-brand-bg)", display: "flex", flexDirection: "column", color: "white" }}>
      <header style={{ padding: "1.5rem 2rem", background: "var(--color-brand-surface)", borderBottom: "1px solid var(--color-brand-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Owner Dashboard</h1>
          <p style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem" }}>Login sebagai: @{user.username} ({user.role})</p>
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <select value={selectedEventId} onChange={(e) => fetchDashboardData(e.target.value)} style={{ padding: "0.5rem 1rem", background: "var(--color-brand-bg)", color: "white", border: "1px solid var(--color-brand-accent)", borderRadius: "8px", outline: "none" }}>
            <option value="all">Semua Penjualan</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
          <button onClick={() => { logout(); router.replace("/login"); }} style={{ padding: "0.5rem 1rem", border: "1px solid var(--color-brand-border)", background: "transparent", color: "var(--color-brand-red)", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}>Keluar</button>
        </div>
      </header>

      <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
        
        {/* Metrik Utama */}
        <div style={{ background: "linear-gradient(135deg, var(--color-brand-card), var(--color-brand-surface))", padding: "2rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-brand-border)" }}>
          <p style={{ color: "var(--color-brand-muted)", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Gross Volume (Total)</p>
          <h2 style={{ fontSize: "3rem", fontWeight: "bold", color: "var(--color-brand-green)" }}>Rp {metrics.gross.toLocaleString("id-ID")}</h2>
        </div>

        {/* Navigasi Routing */}
        <div style={{ display: "flex", gap: "2rem" }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "1.1rem", color: "var(--color-brand-muted)", marginBottom: "1rem", textTransform: "uppercase" }}>🚀 Operasional & Laporan</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
              <NavButton title="Semua Transaksi" path="/owner/transactions" icon="📋" />
              <NavButton title="Events" path="/owner/events" icon="📅" />
              <NavButton title="Settlement" path="/owner/settlement" icon="💰" />
              <NavButton title="Kode Diskon" path="/owner/discounts" icon="🏷️" />
              <NavButton title="Audit Log" path="/owner/audit" icon="🚨" />
            </div>
          </div>
          <div style={{ flex: 1.5 }}>
            <h3 style={{ fontSize: "1.1rem", color: "var(--color-brand-muted)", marginBottom: "1rem", textTransform: "uppercase" }}>🗄️ Master Data</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
              <NavButton title="Data Vendor" path="/owner/vendors" icon="🏢" />
              <NavButton title="Data Akun" path="/owner/users" icon="👥" />
              <NavButton title="Database Stok" path="/owner/stock" icon="📦" />
              <NavButton title="Generate SKU" path="/owner/generate" icon="🖨️" />
            </div>
          </div>
        </div>

        {/* Panel Pantauan Lapangan */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
          
          <div style={{ background: "var(--color-brand-card)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-brand-border)" }}>
            <h3 style={{ fontSize: "1.2rem", marginBottom: "1.5rem" }}>Riwayat Penjualan Terbaru</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
              {recentTxns.map(t => (
                <div key={t.id} style={{ display: "flex", flexDirection: "column", padding: "1rem", background: "var(--color-brand-surface)", borderRadius: "8px", gap: "0.8rem" }}>
                  
                  {/* Baris Atas: Nominal & Kasir */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontWeight: "bold", display: "block", fontSize: "1.1rem" }}>Rp {Number(t.total_amount).toLocaleString("id-ID")}</span>
                      <span style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)" }}>{new Date(t.created_at).toLocaleTimeString('id-ID')} • Kasir: {t.cashier_name}</span>
                    </div>
                    <span style={{ background: t.payment_method === "CASH" ? "rgba(16,185,129,0.2)" : "rgba(124,58,237,0.2)", color: t.payment_method === "CASH" ? "var(--color-brand-green)" : "var(--color-brand-accent-light)", padding: "0.3rem 0.8rem", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "bold" }}>{t.payment_method}</span>
                  </div>

                  {/* Baris Bawah: Detail Barang yang Dijual */}
                  <div style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)", borderTop: "1px dashed var(--color-brand-border)", paddingTop: "0.8rem" }}>
                    <span style={{ color: "var(--color-brand-text)", fontWeight: "bold" }}>Item Terjual: </span>
                    {t.transaction_items && t.transaction_items.length > 0 
                      ? t.transaction_items.map((ti: any) => `${ti.items?.name || 'Unknown'} (${ti.items?.id || '?'})`).join(", ")
                      : "Tidak ada detail barang"}
                  </div>

                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "rgba(239, 68, 68, 0.05)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
            <h3 style={{ fontSize: "1.2rem", color: "var(--color-brand-red)", marginBottom: "1.5rem" }}>Live Void Tracker 🚨</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
              {voidLogs.length === 0 ? <p style={{ color: "var(--color-brand-muted)", fontSize: "0.9rem" }}>Tidak ada void terbaru.</p> : voidLogs.map(v => (
                <div key={v.id} style={{ background: "var(--color-brand-surface)", padding: "0.8rem", borderRadius: "8px", borderLeft: "4px solid var(--color-brand-red)" }}>
                  <div style={{ fontWeight: "bold", fontSize: "0.9rem", color: "white" }}>{v.item_id || "CART CLEAR"}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", marginTop: "0.2rem" }}>Oleh: {v.cashier_name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}