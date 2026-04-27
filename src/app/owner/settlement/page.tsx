"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { executePayout } from "@/app/actions/settlement";

interface VendorSettlement {
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  itemsCount: number;
  grossSales: number;
  commissionCut: number;
  netPayout: number;
  transactionItemsData: { transaction_id: string; item_id: string }[];
}

export default function SettlementDashboard() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  // --- PENDING STATE ---
  const [settlements, setSettlements] = useState<VendorSettlement[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<VendorSettlement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- HISTORY STATE ---
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedPayout, setExpandedPayout] = useState<string | null>(null);
  const [payoutDetails, setPayoutDetails] = useState<Record<string, any[]>>({});
  const [detailsLoading, setDetailsLoading] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 20;

  const fetchPendingData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: tiData, error: tiErr } = await supabase
        .from("transaction_items")
        .select("*")
        .eq("is_settled", false);

      if (tiErr) throw tiErr;
      if (!tiData || tiData.length === 0) {
        setSettlements([]);
        setIsLoading(false);
        return;
      }

      const itemIds = Array.from(new Set(tiData.map((t) => t.item_id)));
      
      const { data: itemsData, error: iErr } = await supabase
        .from("items")
        .select("id, name, vendor_id, vendors(id, name, code)")
        .in("id", itemIds);

      if (iErr) throw iErr;
      if (!itemsData) return;

      const grouped = new Map<string, VendorSettlement>();

      for (const ti of tiData) {
        const item = itemsData.find((i) => i.id === ti.item_id);
        if (!item || !item.vendor_id || !item.vendors) continue;

        const v = item.vendors as any;
        const vendorId = v.id;

        if (!grouped.has(vendorId)) {
          grouped.set(vendorId, {
            vendorId, vendorCode: v.code, vendorName: v.name,
            itemsCount: 0, grossSales: 0, commissionCut: 0, netPayout: 0,
            transactionItemsData: [],
          });
        }

        const group = grouped.get(vendorId)!;

        let gross = Number(ti.price_at_sale);
        if (ti.discount_bearer === "vynalee") {
          gross += Number(ti.discount_applied || 0); 
        }

        const rate = Number(ti.vendor_commission_rate) || 0;
        const commission = Math.round(gross * (rate / 100));
        const net = gross - commission;

        group.itemsCount += 1;
        group.grossSales += gross;
        group.commissionCut += commission;
        group.netPayout += net;
        group.transactionItemsData.push({ transaction_id: ti.transaction_id, item_id: ti.item_id });
      }

      setSettlements(Array.from(grouped.values()).sort((a, b) => b.netPayout - a.netPayout));
    } catch (err) {
      console.error("Fetch Pending Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchHistoryData = useCallback(async (currentPage: number, start: string, end: string) => {
    setHistoryLoading(true);
    try {
      let query = supabase
        .from("vendor_payouts")
        .select("*, vendors(name, code)", { count: "exact" });

      if (start) query = query.gte("paid_at", `${start}T00:00:00.000Z`);
      if (end) query = query.lte("paid_at", `${end}T23:59:59.999Z`);

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, count, error } = await query
        .order("paid_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      
      setHistoryData(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Fetch History Error:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    if (user.role !== "owner" && user.role !== "admin") { router.replace("/kasir"); return; }
    
    if (activeTab === "pending") {
      fetchPendingData();
    } else {
      fetchHistoryData(page, startDate, endDate);
    }
  }, [user, router, activeTab, page, startDate, endDate, fetchPendingData, fetchHistoryData]);

  const handleSettle = async () => {
    if (!selectedVendor || !token) return;
    setIsProcessing(true);

    const payload = {
      total_sales: selectedVendor.grossSales,
      total_commission_deducted: selectedVendor.commissionCut,
      net_payout: selectedVendor.netPayout,
      total_items: selectedVendor.itemsCount,
    };

    const res = await executePayout(token, selectedVendor.vendorId, payload, selectedVendor.transactionItemsData);
    
    setIsProcessing(false);
    if (res.success) {
      setSelectedVendor(null);
      fetchPendingData(); 
    } else {
      alert("Error: " + res.error);
    }
  };

  const loadPayoutDetails = async (payoutId: string) => {
    if (expandedPayout === payoutId) {
      setExpandedPayout(null);
      return;
    }
    
    setExpandedPayout(payoutId);
    
    if (payoutDetails[payoutId]) return; // Already cached

    setDetailsLoading(payoutId);
    try {
      const { data, error } = await supabase
        .from("transaction_items")
        .select("*, items(name, id), transactions(id, created_at)")
        .eq("payout_id", payoutId);

      if (error) throw error;
      
      setPayoutDetails(prev => ({ ...prev, [payoutId]: data || [] }));
    } catch (err) {
      console.error("Fetch Details Error:", err);
    } finally {
      setDetailsLoading(null);
    }
  };

  const formatIDR = (val: number) => "Rp " + val.toLocaleString("id-ID");
  const formatDate = (isoStr: string) => new Intl.DateTimeFormat("id-ID", { 
    day: '2-digit', month: 'short', year: 'numeric', 
    hour: '2-digit', minute: '2-digit',
    timeZone: "Asia/Jakarta"
  }).format(new Date(isoStr));

  const handleExportCSV = (payoutId: string) => {
    const details = payoutDetails[payoutId];
    if (!details || details.length === 0) return;

    const headers = ["Transaction Date", "Receipt ID", "Barcode", "Item Name", "Selling Price", "Commission Cut", "Net to Vendor"];
    const csvContent = [
      headers.join(","),
      ...details.map(item => {
        const trans = (item.transactions as any);
        const gross = Number(item.price_at_sale) + (item.discount_bearer === 'vynalee' ? Number(item.discount_applied) : 0);
        const rate = Number(item.vendor_commission_rate) || 0;
        const comm = Math.round(gross * (rate / 100));
        const net = gross - comm;
        
        return [
          new Intl.DateTimeFormat("id-ID", { 
            dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" 
          }).format(new Date(trans.created_at)),
          trans.id,
          item.item_id,
          `"${(item.items as any)?.name || "Unknown"}"`,
          gross,
          comm,
          net
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Settlement_${payoutId.slice(0, 8)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!user || isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "var(--color-brand-bg)" }}>
        <h2 style={{ color: "var(--color-brand-accent)", fontFamily: "var(--font-mono)" }}>Memuat Settlement Engine...</h2>
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-brand-bg)", padding: "2rem", fontFamily: "var(--font-sans)", color: "var(--color-brand-text)" }}>
      <header style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "2.5rem", fontWeight: "900", margin: 0, letterSpacing: "-1px" }}>Vendor Settlement</h1>
          <p style={{ color: "var(--color-brand-muted)", margin: "0.5rem 0 0 0", fontSize: "1rem" }}>Dasbor Keuangan & Ledger</p>
        </div>
        <button 
          onClick={() => router.push("/kasir")}
          style={{ background: "transparent", color: "var(--color-brand-accent)", border: "1px solid var(--color-brand-accent)", padding: "0.6rem 1.2rem", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", transition: "all 0.2s" }}
        >
          ← Kembali ke Kasir
        </button>
      </header>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", borderBottom: "1px solid var(--color-brand-border)" }}>
        <button 
          onClick={() => setActiveTab("pending")}
          style={{ background: "transparent", border: "none", borderBottom: activeTab === "pending" ? "3px solid var(--color-brand-accent)" : "3px solid transparent", color: activeTab === "pending" ? "var(--color-brand-accent)" : "var(--color-brand-muted)", padding: "1rem 2rem", fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer", transition: "all 0.2s" }}
        >
          Pending Payouts
        </button>
        <button 
          onClick={() => { setActiveTab("history"); setPage(1); }}
          style={{ background: "transparent", border: "none", borderBottom: activeTab === "history" ? "3px solid var(--color-brand-green)" : "3px solid transparent", color: activeTab === "history" ? "var(--color-brand-green)" : "var(--color-brand-muted)", padding: "1rem 2rem", fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer", transition: "all 0.2s" }}
        >
          History Ledger
        </button>
      </div>

      {activeTab === "pending" ? (
        // --- PENDING TAB ---
        settlements.length === 0 ? (
          <div style={{ background: "var(--color-brand-surface)", border: "1px dashed var(--color-brand-border)", borderRadius: "16px", padding: "5rem 2rem", textAlign: "center" }}>
            <span style={{ fontSize: "4rem", display: "block", marginBottom: "1rem" }}>🎉</span>
            <h3 style={{ margin: 0, fontSize: "1.5rem" }}>Semua Vendor Telah Lunas</h3>
            <p style={{ color: "var(--color-brand-muted)" }}>Tidak ada payout yang tertunda saat ini.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.5rem" }}>
            {settlements.map((v) => (
              <div key={v.vendorId} style={{ background: "var(--color-brand-card)", borderRadius: "16px", padding: "1.5rem", border: "1px solid var(--color-brand-border)", display: "flex", flexDirection: "column", gap: "1rem", boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.3rem", fontWeight: "900" }}>{v.vendorName}</h3>
                  <span style={{ display: "inline-block", background: "rgba(255,255,255,0.05)", color: "var(--color-brand-muted)", padding: "0.3rem 0.8rem", borderRadius: "20px", fontSize: "0.8rem", marginTop: "0.5rem", border: "1px solid var(--color-brand-border)" }}>
                    {v.vendorCode} • {v.itemsCount} Item Terjual
                  </span>
                </div>

                <div style={{ background: "var(--color-brand-surface)", borderRadius: "12px", padding: "1.2rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem" }}>
                    <span style={{ color: "var(--color-brand-muted)" }}>Gross Sales</span>
                    <span style={{ fontWeight: "bold" }}>{formatIDR(v.grossSales)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", borderBottom: "1px dashed var(--color-brand-border)", paddingBottom: "0.8rem" }}>
                    <span style={{ color: "var(--color-brand-red)" }}>Toko (- {Math.round((v.commissionCut / v.grossSales) * 100)}%)</span>
                    <span style={{ color: "var(--color-brand-red)", fontWeight: "bold" }}>- {formatIDR(v.commissionCut)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.2rem", marginTop: "0.5rem" }}>
                    <span style={{ fontWeight: "900" }}>Net Payable</span>
                    <span style={{ color: "var(--color-brand-green)", fontWeight: "900" }}>{formatIDR(v.netPayout)}</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedVendor(v)}
                  style={{ width: "100%", background: "var(--color-brand-accent)", color: "#fff", border: "none", padding: "1rem", borderRadius: "12px", fontWeight: "bold", cursor: "pointer", fontSize: "1rem", transition: "transform 0.1s, opacity 0.2s" }}
                  onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.98)"}
                  onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
                >
                  Bayar Vendor
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        // --- HISTORY TAB ---
        <div>
          {/* Filters */}
          <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", background: "var(--color-brand-card)", padding: "1rem", borderRadius: "12px", border: "1px solid var(--color-brand-border)", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)", fontWeight: "bold" }}>Tanggal Mulai</label>
              <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} style={{ padding: "0.6rem", borderRadius: "8px", border: "1px solid var(--color-brand-border)", background: "var(--color-brand-surface)", color: "var(--color-brand-text)", colorScheme: "dark" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)", fontWeight: "bold" }}>Tanggal Akhir</label>
              <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} style={{ padding: "0.6rem", borderRadius: "8px", border: "1px solid var(--color-brand-border)", background: "var(--color-brand-surface)", color: "var(--color-brand-text)", colorScheme: "dark" }} />
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
               {(startDate || endDate) && (
                 <button onClick={() => { setStartDate(""); setEndDate(""); setPage(1); }} style={{ background: "transparent", color: "var(--color-brand-red)", border: "1px solid var(--color-brand-red)", padding: "0.6rem 1rem", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem" }}>
                   Reset Filter
                 </button>
               )}
            </div>
          </div>

          {historyLoading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-brand-muted)" }}>Memuat Ledger...</div>
          ) : historyData.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem", background: "var(--color-brand-surface)", borderRadius: "12px", border: "1px dashed var(--color-brand-border)" }}>
              <h3 style={{ margin: 0, color: "var(--color-brand-muted)" }}>Tidak ada data payout ditemukan</h3>
            </div>
          ) : (
            <>
              {/* Data Table / List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {historyData.map((h) => (
                  <div key={h.id} style={{ background: "var(--color-brand-card)", borderRadius: "12px", border: "1px solid var(--color-brand-border)", overflow: "hidden" }}>
                    {/* Main Row */}
                    <div style={{ padding: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                      <div style={{ flex: 1, minWidth: "200px" }}>
                        <h4 style={{ margin: "0 0 0.3rem 0", fontSize: "1.2rem" }}>{(h.vendors as any)?.name || "Unknown Vendor"}</h4>
                        <div style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)", display: "flex", gap: "1rem" }}>
                          <span>📅 {formatDate(h.paid_at)}</span>
                          <span>📦 {h.total_items} Items</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)", marginBottom: "0.2rem" }}>Net Payout</div>
                        <div style={{ fontSize: "1.3rem", fontWeight: "900", color: "var(--color-brand-green)" }}>{formatIDR(h.net_payout)}</div>
                      </div>
                      <button 
                        onClick={() => loadPayoutDetails(h.id)}
                        style={{ background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-border)", color: "var(--color-brand-text)", padding: "0.6rem 1rem", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
                      >
                        {expandedPayout === h.id ? "Tutup Detail" : "Lihat Item"}
                      </button>
                    </div>

                    {/* Expanded Details */}
                    {expandedPayout === h.id && (
                      <div style={{ background: "var(--color-brand-surface)", padding: "1.5rem", borderTop: "1px solid var(--color-brand-border)" }}>
                        {detailsLoading === h.id ? (
                          <div style={{ color: "var(--color-brand-muted)", textAlign: "center" }}>Mengambil data item...</div>
                        ) : !payoutDetails[h.id] || payoutDetails[h.id].length === 0 ? (
                          <div style={{ color: "var(--color-brand-muted)", textAlign: "center" }}>Detail item tidak ditemukan.</div>
                        ) : (
                          <div style={{ overflowX: "auto" }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
                              <button 
                                onClick={() => handleExportCSV(h.id)}
                                style={{ background: "var(--color-brand-green-dark)", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "0.85rem" }}
                              >
                                📥 Export CSV
                              </button>
                            </div>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                              <thead>
                                <tr style={{ color: "var(--color-brand-muted)", textAlign: "left", borderBottom: "1px solid var(--color-brand-border)" }}>
                                  <th style={{ padding: "0.8rem 0", fontWeight: "normal" }}>Barcode / ID</th>
                                  <th style={{ padding: "0.8rem", fontWeight: "normal" }}>Nama Barang</th>
                                  <th style={{ padding: "0.8rem", fontWeight: "normal", textAlign: "right" }}>Gross</th>
                                  <th style={{ padding: "0.8rem", fontWeight: "normal", textAlign: "right" }}>Potongan ({h.total_commission_deducted > 0 ? "Toko" : "-"})</th>
                                </tr>
                              </thead>
                              <tbody>
                                {payoutDetails[h.id].map((item, idx) => {
                                  const name = (item.items as any)?.name || "Barang Void/Dihapus";
                                  const barcode = item.item_id;
                                  const gross = Number(item.price_at_sale) + (item.discount_bearer === 'vynalee' ? Number(item.discount_applied) : 0);
                                  const rate = Number(item.vendor_commission_rate) || 0;
                                  const comm = Math.round(gross * (rate / 100));

                                  return (
                                    <tr key={`${item.transaction_id}-${item.item_id}-${idx}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                      <td style={{ padding: "0.8rem 0", fontFamily: "var(--font-mono)", color: "var(--color-brand-accent)" }}>{barcode}</td>
                                      <td style={{ padding: "0.8rem" }}>{name}</td>
                                      <td style={{ padding: "0.8rem", textAlign: "right" }}>{formatIDR(gross)}</td>
                                      <td style={{ padding: "0.8rem", textAlign: "right", color: "var(--color-brand-red)" }}>- {formatIDR(comm)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1rem", marginTop: "2rem" }}>
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    style={{ background: "var(--color-brand-card)", border: "1px solid var(--color-brand-border)", color: "var(--color-brand-text)", padding: "0.6rem 1.2rem", borderRadius: "8px", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.5 : 1 }}
                  >
                    Mundur
                  </button>
                  <span style={{ fontSize: "0.9rem", color: "var(--color-brand-muted)" }}>Halaman {page} dari {totalPages}</span>
                  <button 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    style={{ background: "var(--color-brand-card)", border: "1px solid var(--color-brand-border)", color: "var(--color-brand-text)", padding: "0.6rem 1.2rem", borderRadius: "8px", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.5 : 1 }}
                  >
                    Maju
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {selectedVendor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }} onClick={(e) => { if (e.target === e.currentTarget) setSelectedVendor(null); }}>
          <div style={{ background: "var(--color-brand-card)", borderRadius: "16px", width: "100%", maxWidth: "420px", padding: "2.5rem", border: "1px solid var(--color-brand-border)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1.8rem" }}>Konfirmasi Payout</h2>
            <p style={{ color: "var(--color-brand-muted)", fontSize: "0.95rem", marginBottom: "2rem", lineHeight: "1.5" }}>
              Anda akan mengeksekusi settlement untuk <strong>{selectedVendor.vendorName}</strong>. Pastikan Anda telah mentransfer dana ke rekening vendor ini.
            </p>

            <div style={{ background: "var(--color-brand-surface)", padding: "1.5rem", borderRadius: "12px", textAlign: "center", marginBottom: "2rem", border: "1px solid var(--color-brand-border)" }}>
              <span style={{ display: "block", color: "var(--color-brand-muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Total Transfer Bersih</span>
              <span style={{ display: "block", color: "var(--color-brand-green)", fontSize: "2.5rem", fontWeight: "900", letterSpacing: "-1px" }}>
                {formatIDR(selectedVendor.netPayout)}
              </span>
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <button 
                onClick={() => setSelectedVendor(null)} disabled={isProcessing}
                style={{ flex: 1, background: "transparent", color: "var(--color-brand-text)", border: "1px solid var(--color-brand-border)", padding: "1rem", borderRadius: "12px", fontWeight: "bold", cursor: isProcessing ? "not-allowed" : "pointer" }}
              >
                Batal
              </button>
              <button 
                onClick={handleSettle} disabled={isProcessing}
                style={{ flex: 1, background: "var(--color-brand-green)", color: "#000", border: "none", padding: "1rem", borderRadius: "12px", fontWeight: "900", cursor: isProcessing ? "not-allowed" : "pointer", opacity: isProcessing ? 0.7 : 1 }}
              >
                {isProcessing ? "Menyimpan..." : "Settle Sekarang"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}