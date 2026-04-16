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

  const limit = 15;
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [eventId, setEventId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!user || user.role !== "owner") router.replace("/login");
    else { fetchEvents(); fetchTxns(); }
  }, [user, router, page]);

  const fetchEvents = async () => {
    const { data } = await supabase.from("events").select("id, name").order("created_at", { ascending: false });
    if (data) setEvents(data);
  };

  const fetchTxns = async () => {
    setLoading(true);
    let query = supabase.from("transactions").select(`
      id, total_amount, cashier_name, payment_method, created_at, discount_applied, discount_code, customer_phone,
      transaction_items ( items ( id, name, price ) ),
      events ( name )
    `, { count: "exact" });

    if (search.trim()) query = query.or(`id.eq.${search.trim()},cashier_name.ilike.%${search.trim()}%`);
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

  const handleVoidTransaction = async (txnId: string) => {
    const reason = prompt("Masukkan alasan pembatalan transaksi (VOID):");
    if (!reason) return;
    if (!confirm(`SANGAT FATAL: Anda yakin ingin membatalkan transaksi ${txnId}? Stok barang akan dikembalikan.`)) return;

    const { data: pivotData } = await supabase.from("transaction_items").select("item_id").eq("transaction_id", txnId);
    if (pivotData) {
      const itemIds = pivotData.map(p => p.item_id);
      await supabase.from("items").update({ status: "available" }).in("id", itemIds);
      await supabase.from("audit_logs").insert({ action: "VOID_TRANSACTION", item_id: txnId, cashier_name: user?.name, cashier_id: user?.id, reason });
      await supabase.from("transaction_items").delete().eq("transaction_id", txnId);
      await supabase.from("transactions").delete().eq("id", txnId);
      alert("Transaksi berhasil dibatalkan dan stok dikembalikan.");
      fetchTxns();
    }
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  if (!user) return null;

  return (
    <div className="wnp-page">
      <PageHeader title="Riwayat Transaksi Master" />

      <div className="wnp-page-content">
        <div className="wnp-card">

          {/* Filter Form */}
          <form onSubmit={handleFilterSubmit} style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
            <input type="text" placeholder="Cari ID / Nama Kasir..." value={search}
              onChange={e => setSearch(e.target.value)} className="wnp-input" style={{ flex: "1 1 160px" }} />
            <select value={eventId} onChange={e => setEventId(e.target.value)} className="wnp-input" style={{ flex: "1 1 140px" }}>
              <option value="all">Semua Event</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="wnp-input" style={{ flex: "0 1 auto" }} title="Dari" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="wnp-input" style={{ flex: "0 1 auto" }} title="Sampai" />
            <button type="submit" className="wnp-btn wnp-btn-primary" style={{ flexShrink: 0 }}>🔍 Cari</button>
          </form>

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
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{new Date(t.created_at).toLocaleString("id-ID")}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--color-brand-muted)", fontFamily: "var(--font-mono)" }}>
                        {t.id.split("-")[0].toUpperCase()}
                      </div>
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
                    <td style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.transaction_items?.map((ti: any) => ti.items?.name || "?").join(", ")}
                    </td>
                    <td>
                      <button onClick={() => handleVoidTransaction(t.id)} className="wnp-btn wnp-btn-danger" style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem" }}>
                        Void
                      </button>
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
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="wnp-btn wnp-btn-ghost" style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}>
                ← Mundur
              </button>
              <span style={{ fontWeight: "bold", fontSize: "0.9rem", whiteSpace: "nowrap" }}>{page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="wnp-btn wnp-btn-ghost" style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}>
                Maju →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}