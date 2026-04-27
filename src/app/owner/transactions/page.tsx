"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";

export default function TransactionsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [cashiers, setCashiers] = useState<any[]>([]);

  const limit = 15;
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedCashier, setSelectedCashier] = useState("all");
  const [eventId, setEventId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Partial void modal state
  const [returnModal, setReturnModal] = useState<{ txn: any; items: any[] } | null>(null);
  const [returnReason, setReturnReason] = useState("");

  useEffect(() => {
    if (!user || (user.role !== "owner" && user.role !== "admin")) router.replace("/login");
    else { fetchEvents(); fetchCashiers(); fetchTxns(); }
  }, [user, router, page]);

  const fetchEvents = async () => {
    const { data } = await supabase.from("events").select("id, name").order("created_at", { ascending: false });
    if (data) setEvents(data);
  };

  // Task 4: Only fetch users where role = 'kasir'
  const fetchCashiers = async () => {
    const { data } = await supabase
      .from("users")
      .select("id, name, username")
      .eq("role", "kasir")
      .eq("is_active", true)
      .order("name");
    if (data) setCashiers(data);
  };

  const fetchTxns = async () => {
    setLoading(true);
    let query = supabase.from("transactions").select(`
      id, total_amount, cashier_name, payment_method, created_at, discount_applied, discount_code, customer_phone, status,
      transaction_items ( item_id, price_at_sale, items ( id, name, price, status ) ),
      events ( name )
    `, { count: "exact" });

    if (selectedCashier !== "all") query = query.eq("cashier_name", selectedCashier);
    if (eventId !== "all") query = query.eq("event_id", eventId);
    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00+07:00`);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59+07:00`);

    query = query.order("created_at", { ascending: false });
    const fromIndex = (page - 1) * limit;
    query = query.range(fromIndex, fromIndex + limit - 1);

    const { data, count, error } = await query;
    if (error) console.error(error);
    if (data) setTxns(data);
    if (count !== null) setTotalCount(count);
    setLoading(false);
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTxns();
  };

  // Full void (entire transaction)
  const handleVoidTransaction = async (txnId: string) => {
    const reason = prompt("Masukkan alasan pembatalan transaksi (VOID):");
    if (!reason) return;
    if (!confirm(`FATAL: Anda yakin ingin membatalkan seluruh transaksi ${txnId.slice(0,8).toUpperCase()}?`)) return;

    const { data: pivotData } = await supabase.from("transaction_items").select("item_id").eq("transaction_id", txnId);
    if (pivotData) {
      const itemIds = pivotData.map(p => p.item_id);
      await supabase.from("items").update({ status: "available" }).in("id", itemIds);
      await supabase.from("audit_logs").insert({
        action: "VOID_TRANSACTION", item_id: txnId,
        cashier_name: user?.name, cashier_id: user?.id, reason,
      });
      await supabase.from("transactions").update({ status: "void", void_reason: reason, void_by: user?.name, void_at: new Date().toISOString() }).eq("id", txnId);
      alert("Transaksi berhasil dibatalkan dan stok dikembalikan.");
      fetchTxns();
    }
  };

  // Open partial void modal — load item details for this transaction
  const openReturnModal = async (txn: any) => {
    const { data } = await supabase
      .from("transaction_items")
      .select("item_id, price_at_sale, items ( id, name, status )")
      .eq("transaction_id", txn.id);
    setReturnModal({ txn, items: data || [] });
    setReturnReason("");
  };

  // Task 3: Partial void — return a single item within a transaction
  const handleReturnItem = async (txn: any, itemId: string, priceAtSale: number) => {
    if (!returnReason.trim()) return alert("Masukkan alasan return terlebih dahulu.");
    if (!confirm(`Return item ${itemId} dari transaksi ini? Total transaksi akan dikurangi Rp ${priceAtSale.toLocaleString("id-ID")}.`)) return;

    // 1. Update item status to 'return'
    await supabase.from("items").update({ status: "return" }).eq("id", itemId);

    // 2. Adjust transaction total
    const newTotal = Number(txn.total_amount) - priceAtSale;
    await supabase.from("transactions").update({ total_amount: Math.max(0, newTotal) }).eq("id", txn.id);

    // 3. Audit log
    await supabase.from("audit_logs").insert({
      action: "ITEM_RETURN",
      item_id: itemId,
      transaction_id: txn.id,
      cashier_name: user?.name,
      cashier_id: user?.id,
      reason: returnReason,
      old_value: `price_at_sale: ${priceAtSale}`,
    });

    alert(`✅ Item ${itemId} berhasil di-return. Stok dikembalikan ke status RETURN.`);
    setReturnModal(null);
    fetchTxns();
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;
  if (!user) return null;

  return (
    <div className="wnp-page">
      <PageHeader title="Riwayat Transaksi Master" />

      <div className="wnp-page-content">
        <div className="wnp-card">

          {/* Filter Form */}
          <form onSubmit={handleFilterSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1.25rem" }}>

            {/* Baris 1: Kasir + Event */}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <select
                value={selectedCashier}
                onChange={e => setSelectedCashier(e.target.value)}
                className="wnp-input"
                style={{ flex: "1 1 180px" }}
              >
                <option value="all">— Semua Kasir —</option>
                {cashiers.map(c => (
                  <option key={c.id} value={c.name}>{c.name} (@{c.username})</option>
                ))}
              </select>

              <select value={eventId} onChange={e => setEventId(e.target.value)} className="wnp-input" style={{ flex: "1 1 160px" }}>
                <option value="all">Semua Event</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
            </div>

            {/* Baris 2: Filter Tanggal */}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 160px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "bold", color: "var(--color-brand-muted)", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  📅 Dari Tanggal
                  <span style={{ display: "block", fontSize: "0.68rem", fontWeight: "normal", textTransform: "none", marginTop: "0.1rem" }}>Batas awal pencarian transaksi</span>
                </label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="wnp-input" style={{ width: "100%", colorScheme: "dark" }} />
              </div>

              <div style={{ flex: "1 1 160px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "bold", color: "var(--color-brand-muted)", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  📅 Sampai Tanggal
                  <span style={{ display: "block", fontSize: "0.68rem", fontWeight: "normal", textTransform: "none", marginTop: "0.1rem" }}>Batas akhir pencarian transaksi</span>
                </label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} min={dateFrom} className="wnp-input" style={{ width: "100%", colorScheme: "dark" }} />
              </div>

              <button type="submit" className="wnp-btn wnp-btn-primary" style={{ flexShrink: 0, alignSelf: "flex-end" }}>
                🔍 Cari
              </button>
            </div>
          </form>

          <style>{`[data-theme="light"] input[type="date"]{color-scheme:light;}`}</style>

          {/* Table */}
          <div className="wnp-table-wrapper">
            <table className="wnp-table">
              <thead>
                <tr>
                  <th>Tanggal &amp; ID</th>
                  <th>Kasir &amp; Event</th>
                  <th>Metode</th>
                  <th>Total</th>
                  <th>Detail Barang</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--color-brand-muted)" }}>Menarik data...</td></tr>
                ) : txns.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--color-brand-muted)" }}>Tidak ada transaksi.</td></tr>
                ) : txns.map(t => (
                  <tr key={t.id} style={{ opacity: t.status === "void" ? 0.5 : 1 }}>
                    <td>
                      <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{new Date(t.created_at).toLocaleString("id-ID")}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--color-brand-muted)", fontFamily: "var(--font-mono)" }}>
                        {t.id.split("-")[0].toUpperCase()}
                      </div>
                      {t.status === "void" && <span className="wnp-badge wnp-badge-red" style={{ fontSize: "0.65rem" }}>VOID</span>}
                    </td>
                    <td>
                      <div style={{ fontWeight: "bold" }}>{t.cashier_name}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--color-brand-accent-light)" }}>{t.events?.name || "Harian"}</div>
                    </td>
                    <td><span className={`wnp-badge ${t.payment_method === "CASH" ? "wnp-badge-green" : "wnp-badge-purple"}`}>{t.payment_method}</span></td>
                    <td>
                      <div style={{ fontWeight: "bold", color: "var(--color-brand-green)" }}>Rp {Number(t.total_amount).toLocaleString("id-ID")}</div>
                      {t.discount_applied > 0 && <div style={{ fontSize: "0.7rem", color: "var(--color-brand-yellow)" }}>-Rp {Number(t.discount_applied).toLocaleString("id-ID")}</div>}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.transaction_items?.map((ti: any) => ti.items?.name || "?").join(", ")}
                    </td>
                    <td>
                      {t.status !== "void" && (
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                          <button onClick={() => openReturnModal(t)} className="wnp-btn wnp-btn-ghost" style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem" }}>
                            ↩ Return Item
                          </button>
                          <button onClick={() => handleVoidTransaction(t.id)} className="wnp-btn wnp-btn-danger" style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem" }}>
                            Void All
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <span style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem" }}>Total: {totalCount} transaksi</span>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="wnp-btn wnp-btn-ghost" style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}>← Mundur</button>
              <span style={{ fontWeight: "bold", fontSize: "0.9rem", whiteSpace: "nowrap" }}>{page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="wnp-btn wnp-btn-ghost" style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}>Maju →</button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== PARTIAL RETURN MODAL ===== */}
      {returnModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: "1rem" }}>
          <div className="fade-in" style={{ background: "var(--color-brand-card)", border: "1px solid var(--color-brand-border)", borderRadius: "var(--radius-2xl)", padding: "2rem", width: "100%", maxWidth: "520px" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "0.25rem" }}>↩ Return Item</h2>
            <p style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", marginBottom: "1.25rem" }}>
              Transaksi: <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-brand-accent-light)" }}>{returnModal.txn.id.slice(0,8).toUpperCase()}</span>
            </p>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.4rem", fontWeight: "bold" }}>Alasan Return *</label>
              <input
                type="text"
                placeholder="contoh: Barang cacat / keluhan pelanggan"
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
                className="wnp-input"
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", maxHeight: "300px", overflowY: "auto", marginBottom: "1.25rem" }}>
              {returnModal.items.map((ti: any) => {
                const alreadyReturned = ti.items?.status === "return";
                return (
                  <div key={ti.item_id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "0.75rem 1rem", background: "var(--color-brand-surface)",
                    borderRadius: "8px", gap: "0.75rem",
                    opacity: alreadyReturned ? 0.4 : 1,
                    border: alreadyReturned ? "1px solid var(--color-brand-muted)" : "1px solid var(--color-brand-border)",
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{ti.items?.name || ti.item_id}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--color-brand-muted)", fontFamily: "var(--font-mono)" }}>{ti.item_id}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--color-brand-green)", marginTop: "0.2rem" }}>
                        Rp {Number(ti.price_at_sale).toLocaleString("id-ID")}
                      </div>
                    </div>
                    {alreadyReturned ? (
                      <span className="wnp-badge wnp-badge-yellow" style={{ fontSize: "0.7rem" }}>RETURNED</span>
                    ) : (
                      <button
                        onClick={() => handleReturnItem(returnModal.txn, ti.item_id, Number(ti.price_at_sale))}
                        className="wnp-btn wnp-btn-danger"
                        style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem", flexShrink: 0 }}
                      >
                        Return ↩
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={() => setReturnModal(null)} className="wnp-btn wnp-btn-ghost" style={{ width: "100%" }}>
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}