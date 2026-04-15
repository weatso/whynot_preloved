"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";

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
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(200);
    if (data) setLogs(data);
    setLoading(false);
  };

  if (!user) return null;

  return (
    <div style={{ padding: "2rem", background: "var(--color-brand-bg)", minHeight: "100vh", color: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "var(--color-brand-red)" }}>Audit Log Keamanan 🚨</h1>
        <button onClick={() => router.push("/owner")} style={{ padding: "0.5rem 1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", cursor: "pointer" }}>← Dashboard</button>
      </div>

      <div style={{ background: "var(--color-brand-card)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-brand-border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <p style={{ color: "var(--color-brand-muted)" }}>Catatan aktivitas pembatalan transaksi dan modifikasi keranjang kasir secara real-time.</p>
          <button onClick={fetchLogs} style={{ padding: "0.5rem 1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "6px", cursor: "pointer" }}>🔄 Refresh Data</button>
        </div>

        <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid var(--color-brand-border)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "var(--color-brand-surface)", color: "var(--color-brand-muted)", fontSize: "0.85rem", textTransform: "uppercase" }}>
                <th style={{ padding: "1rem", borderBottom: "1px solid var(--color-brand-border)" }}>Waktu Kejadian</th>
                <th style={{ padding: "1rem", borderBottom: "1px solid var(--color-brand-border)" }}>Aksi</th>
                <th style={{ padding: "1rem", borderBottom: "1px solid var(--color-brand-border)" }}>Kasir</th>
                <th style={{ padding: "1rem", borderBottom: "1px solid var(--color-brand-border)" }}>Target (ID)</th>
                <th style={{ padding: "1rem", borderBottom: "1px solid var(--color-brand-border)" }}>Alasan Sistem</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--color-brand-muted)" }}>Menarik data server...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--color-brand-muted)" }}>Tidak ada anomali aktivitas tercatat.</td></tr>
              ) : logs.map(log => (
                <tr key={log.id} style={{ borderBottom: "1px solid var(--color-brand-border)", background: "var(--color-brand-card)" }}>
                  <td style={{ padding: "1rem", fontSize: "0.9rem" }}>{new Date(log.timestamp).toLocaleString("id-ID")}</td>
                  <td style={{ padding: "1rem", fontWeight: "bold", color: "var(--color-brand-red)" }}>{log.action}</td>
                  <td style={{ padding: "1rem" }}>{log.cashier_name}</td>
                  <td style={{ padding: "1rem", fontFamily: "var(--font-mono)", color: "var(--color-brand-accent-light)" }}>{log.item_id || "-"}</td>
                  <td style={{ padding: "1rem", fontSize: "0.9rem", color: "var(--color-brand-muted)" }}>{log.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}