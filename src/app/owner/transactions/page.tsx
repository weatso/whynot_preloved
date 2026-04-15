"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";

export default function TransactionsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);

  // Filter & Pagination States
  const limit = 15;
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const [search, setSearch] = useState("");
  const [eventId, setEventId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!user || user.role !== "owner") router.replace("/login");
    else {
      fetchEvents();
      fetchTxns();
    }
  }, [user, router, page]);

  const fetchEvents = async () => {
    const { data } = await supabase.from("events").select("id, name").order("created_at", { ascending: false });
    if (data) setEvents(data);
  };

  const fetchTxns = async () => {
    setLoading(true);
    // Join dengan tabel items dan events untuk detail lengkap
    let query = supabase.from("transactions").select(`
      id, total_amount, cashier_name, payment_method, created_at, discount_applied, discount_code, customer_phone,
      transaction_items ( items ( id, name, price ) ),
      events ( name )
    `, { count: "exact" });

    // Terapkan Filter
    if (search.trim()) query = query.or(`id.eq.${search.trim()},cashier_name.ilike.%${search.trim()}%`);
    if (eventId !== "all") query = query.eq("event_id", eventId);
    
    // Konversi zona waktu ke WIB (+07:00) agar akurat di lapangan
    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00+07:00`);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59+07:00`);

    // Urutkan & Pagination
    query = query.order("created_at", { ascending: false });
    const fromIndex = (page - 1) * limit;
    const toIndex = fromIndex + limit - 1;
    query = query.range(fromIndex, toIndex);

    const { data, count, error } = await query;
    if (error) console.error(error);
    if (data) setTxns(data);
    if (count !== null) setTotalCount(count);
    
    setLoading(false);
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset ke halaman 1 saat filter berubah
    fetchTxns();
  };

  // FItur Void Khusus Owner
  const handleVoidTransaction = async (txnId: string) => {
    const reason = prompt("Masukkan alasan pembatalan transaksi (VOID):");
    if (!reason) return;

    if (!confirm(`SANGAT FATAL: Anda yakin ingin membatalkan transaksi ${txnId}? Stok barang akan dikembalikan.`)) return;

    // 1. Tarik detail items dari transaksi ini
    const { data: pivotData } = await supabase.from("transaction_items").select("item_id").eq("transaction_id", txnId);
    if (pivotData) {
      const itemIds = pivotData.map(p => p.item_id);
      // 2. Kembalikan stok
      await supabase.from("items").update({ status: "available" }).in("id", itemIds);
      // 3. Catat di Audit Log
      await supabase.from("audit_logs").insert({
        action: "VOID_TRANSACTION",
        item_id: txnId,
        cashier_name: user?.name,
        cashier_id: user?.id,
        reason: reason
      });
      // 4. Ubah status transaksi (Jika Anda punya kolom status, jika tidak, hapus total. Kita asumsikan hapus total untuk MVP)
      await supabase.from("transaction_items").delete().eq("transaction_id", txnId);
      await supabase.from("transactions").delete().eq("id", txnId);
      
      alert("Transaksi berhasil dibatalkan dan stok dikembalikan.");
      fetchTxns();
    }
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  if (!user) return null;

  return (
    <div style={{ padding: "2rem", background: "var(--color-brand-bg)", minHeight: "100vh", color: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>Riwayat Transaksi Master</h1>
        <button onClick={() => router.push("/owner")} style={{ padding: "0.5rem 1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", cursor: "pointer" }}>← Dashboard</button>
      </div>

      <div style={{ background: "var(--color-brand-card)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-brand-border)" }}>
        
        {/* ENGINE FILTER */}
        <form onSubmit={handleFilterSubmit} style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <input type="text" placeholder="Cari ID Transaksi / Nama Kasir..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: "200px", padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }} />
          
          <select value={eventId} onChange={e => setEventId(e.target.value)} style={{ padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }}>
            <option value="all">Semua Event / Harian</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>

          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }} title="Dari Tanggal" />
          <span style={{ display: "flex", alignItems: "center", color: "var(--color-brand-muted)" }}>-</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }} title="Sampai Tanggal" />

          <button type="submit" style={{ padding: "1rem 2rem", background: "var(--color-brand-accent)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>🔍 Cari Data</button>
        </form>

        {/* TABEL DATA */}
        <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid var(--color-brand-border)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "var(--color-brand-surface)", color: "var(--color-brand-muted)", fontSize: "0.85rem", textTransform: "uppercase" }}>
                <th style={{ padding: "1rem", borderBottom: "1px solid var(--color-brand-border)" }}>Tanggal & ID</th>
                <th style={{ padding: "1rem", borderBottom: "1px solid var(--color-brand-border)" }}>Kasir & Event</th>
                <th style={{ padding: "1rem", borderBottom: "1px solid var(--color-brand-border)" }}>Metode</th>
                <th style={{ padding: "1rem", borderBottom: "1px solid var(--color-brand-border)" }}>Total Bersih</th>
                <th style={{ padding: "1rem", borderBottom: "1px solid var(--color-brand-border)" }}>Detail Barang Keluar</th>
                <th style={{ padding: "1rem", borderBottom: "1px solid var(--color-brand-border)" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--color-brand-muted)" }}>Menarik data dari server...</td></tr>
              ) : txns.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--color-brand-muted)" }}>Tidak ada transaksi yang cocok.</td></tr>
              ) : txns.map(t => (
                <tr key={t.id} style={{ borderBottom: "1px solid var(--color-brand-border)", background: "var(--color-brand-card)" }}>
                  <td style={{ padding: "1rem" }}>
                    <div style={{ fontWeight: "bold", fontSize: "0.95rem" }}>{new Date(t.created_at).toLocaleString("id-ID")}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", fontFamily: "var(--font-mono)", marginTop: "0.2rem" }}>TXN: {t.id.split('-')[0].toUpperCase()}</div>
                  </td>
                  <td style={{ padding: "1rem" }}>
                    <div style={{ fontWeight: "bold" }}>{t.cashier_name}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--color-brand-accent-light)" }}>{t.events?.name || "Penjualan Harian"}</div>
                  </td>
                  <td style={{ padding: "1rem" }}>
                    <span style={{ background: t.payment_method === "CASH" ? "rgba(16,185,129,0.2)" : "rgba(124,58,237,0.2)", color: t.payment_method === "CASH" ? "var(--color-brand-green)" : "var(--color-brand-accent-light)", padding: "0.3rem 0.6rem", borderRadius: "4px", fontSize: "0.8rem", fontWeight: "bold" }}>{t.payment_method}</span>
                  </td>
                  <td style={{ padding: "1rem" }}>
                    <div style={{ fontWeight: "bold", color: "var(--color-brand-green)", fontSize: "1.1rem" }}>Rp {Number(t.total_amount).toLocaleString("id-ID")}</div>
                    {t.discount_applied > 0 && <div style={{ fontSize: "0.75rem", color: "var(--color-brand-yellow)" }}>Diskon: -Rp {Number(t.discount_applied).toLocaleString("id-ID")}</div>}
                  </td>
                  <td style={{ padding: "1rem", fontSize: "0.85rem", color: "var(--color-brand-muted)", maxWidth: "300px" }}>
                    {t.transaction_items?.map((ti: any) => `${ti.items?.name || 'Item Dihapus'} (${ti.items?.id || '?'})`).join(", ")}
                  </td>
                  <td style={{ padding: "1rem" }}>
                    <button onClick={() => handleVoidTransaction(t.id)} style={{ padding: "0.5rem", background: "rgba(239, 68, 68, 0.1)", color: "var(--color-brand-red)", border: "1px solid var(--color-brand-red)", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "bold" }}>Void Transaksi</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem" }}>
          <span style={{ color: "var(--color-brand-muted)", fontSize: "0.9rem" }}>Total: {totalCount} transaksi</span>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "0.5rem 1rem", background: "var(--color-brand-surface)", color: "white", border: "none", borderRadius: "6px", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.5 : 1 }}>Mundur</button>
            <span style={{ fontWeight: "bold" }}>Halaman {page} dari {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "0.5rem 1rem", background: "var(--color-brand-surface)", color: "white", border: "none", borderRadius: "6px", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.5 : 1 }}>Maju</button>
          </div>
        </div>

      </div>
    </div>
  );
}