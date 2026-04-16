"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";

export default function AuditLogPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "owner") router.replace("/login");
    else fetchLogs();
  }, [user, router]);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase.from("audit_logs").select("*").order("timestamp", { ascending: false }).limit(200);
    if (data) setLogs(data);
    setLoading(false);
  };

  if (!user) return null;

  const actionBadgeClass = (action: string) => {
    if (action.includes("VOID")) return "wnp-badge-red";
    if (action.includes("CLEAR")) return "wnp-badge-yellow";
    return "wnp-badge-gray";
  };

  return (
    <div className="wnp-page">
      <PageHeader title="Audit Log Keamanan 🚨">
        <button onClick={fetchLogs} className="wnp-btn wnp-btn-ghost" style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}>
          🔄 Refresh
        </button>
      </PageHeader>

      <div className="wnp-page-content">
        <div className="wnp-card">
          <p style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
            Catatan aktivitas pembatalan transaksi dan modifikasi keranjang kasir secara real-time.
          </p>

          <div className="wnp-table-wrapper">
            <table className="wnp-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Aksi</th>
                  <th>Kasir</th>
                  <th>Target (ID)</th>
                  <th>Alasan</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--color-brand-muted)" }}>Menarik data...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--color-brand-muted)" }}>Tidak ada anomali tercatat.</td></tr>
                ) : logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: "0.85rem" }}>{new Date(log.timestamp).toLocaleString("id-ID")}</td>
                    <td><span className={`wnp-badge ${actionBadgeClass(log.action)}`}>{log.action}</span></td>
                    <td>{log.cashier_name}</td>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--color-brand-accent-light)", fontSize: "0.85rem" }}>{log.item_id || "—"}</td>
                    <td style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {log.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}