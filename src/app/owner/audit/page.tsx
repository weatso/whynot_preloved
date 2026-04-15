"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { supabase } from "@/lib/supabase";

interface AuditLog { id:string; action:string; item_id:string|null; transaction_id:string|null; cashier_name:string|null; reason:string|null; old_value:string|null; new_value:string|null; timestamp:string; }

const ACTION_COLORS: Record<string,string> = {
  VOID_ITEM:"var(--color-brand-red)", CART_CLEAR:"var(--color-brand-orange)",
  VOID_TRANSACTION:"var(--color-brand-red)", CHANGE_PRICE:"var(--color-brand-yellow)",
  DISCOUNT_OVERRIDE:"var(--color-brand-yellow)",
};

export default function AuditPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => { if (!user) router.replace("/login"); else if (user.role !== "owner") router.replace("/kasir"); }, [user, router]);

  const fetchLogs = useCallback(async () => {
    const start = `${dateFilter}T00:00:00.000Z`;
    const end = `${dateFilter}T23:59:59.999Z`;
    let query = supabase.from("audit_logs").select("*").gte("timestamp",start).lte("timestamp",end).order("timestamp",{ascending:false}).limit(200);
    if (filter !== "ALL") query = query.eq("action", filter);
    const { data } = await query;
    setLogs(data || []);
    setLoading(false);
  }, [dateFilter, filter]);

  useEffect(() => { fetchLogs(); const t = setInterval(fetchLogs, 8000); return () => clearInterval(t); }, [fetchLogs]);

  const fTime = (iso:string) => new Date(iso).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const actions = ["ALL","VOID_ITEM","CART_CLEAR","VOID_TRANSACTION","CHANGE_PRICE"];

  if (!user || user.role !== "owner") return null;

  return (
    <div style={{ minHeight:"100vh", background:"var(--color-brand-bg)", fontFamily:"var(--font-display)" }}>
      <header style={{ background:"var(--color-brand-surface)", borderBottom:"1px solid var(--color-brand-border)", padding:"0.875rem 1.5rem", display:"flex", alignItems:"center", gap:"0.75rem" }}>
        <button id="btn-back-audit" onClick={() => router.push("/owner")} style={{ background:"transparent", border:"1px solid var(--color-brand-border)", borderRadius:"8px", padding:"5px 12px", color:"var(--color-brand-muted)", cursor:"pointer", fontSize:"0.8rem", fontFamily:"var(--font-display)" }}>← Dashboard</button>
        <span style={{ fontSize:"1.25rem" }}>🔍</span>
        <span style={{ fontWeight:"700", color:"var(--color-brand-text)" }}>Audit Log</span>
        <span style={{ marginLeft:"0.5rem", fontSize:"0.7rem", color:"var(--color-brand-red)", background:"rgba(239,68,68,0.15)", padding:"2px 8px", borderRadius:"20px", fontWeight:"600" }}>ANTI-KECURANGAN</span>
      </header>

      <div style={{ maxWidth:"1100px", margin:"0 auto", padding:"1.5rem" }}>
        <div style={{ display:"flex", gap:"1rem", marginBottom:"1.5rem", flexWrap:"wrap" as const, alignItems:"center" }}>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            style={{ background:"var(--color-brand-card)", border:"1px solid var(--color-brand-border)", borderRadius:"8px", padding:"0.5rem 0.875rem", color:"var(--color-brand-text)", fontSize:"0.875rem", fontFamily:"var(--font-display)", outline:"none" }}/>
          <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap" as const }}>
            {actions.map(a => (
              <button key={a} onClick={() => setFilter(a)}
                style={{ padding:"5px 14px", borderRadius:"20px", border:`1px solid ${filter===a?"var(--color-brand-accent)":"var(--color-brand-border)"}`, background:filter===a?"rgba(124,58,237,0.2)":"transparent", color:filter===a?"var(--color-brand-accent-light)":"var(--color-brand-muted)", cursor:"pointer", fontSize:"0.78rem", fontWeight:"600", fontFamily:"var(--font-display)", textTransform:"uppercase" as const }}>
                {a.replace("_"," ")}
              </button>
            ))}
          </div>
          <span style={{ marginLeft:"auto", fontSize:"0.8rem", color:"var(--color-brand-muted)" }}>{logs.length} entri · refresh 8d</span>
        </div>

        <div style={{ background:"var(--color-brand-card)", border:"1px solid var(--color-brand-border)", borderRadius:"var(--radius-xl)", overflow:"hidden" }}>
          <div style={{ overflowX:"auto" as const }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.825rem" }}>
              <thead>
                <tr>{["Waktu","Action","Item ID","Transaksi","Kasir","Alasan","Sebelum","Sesudah"].map(h => (
                  <th key={h} style={{ padding:"0.75rem 1rem", textAlign:"left" as const, background:"var(--color-brand-surface)", color:"var(--color-brand-muted)", fontWeight:"600", fontSize:"0.7rem", textTransform:"uppercase" as const, letterSpacing:"0.07em", border:"1px solid var(--color-brand-border)", whiteSpace:"nowrap" as const }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign:"center" as const, padding:"3rem", color:"var(--color-brand-muted)" }}>Memuat...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign:"center" as const, padding:"3rem", color:"var(--color-brand-muted)" }}>Tidak ada log untuk filter ini</td></tr>
                ) : logs.map(log => (
                  <tr key={log.id} className="log-enter" style={{ borderBottom:"1px solid var(--color-brand-border)" }}>
                    <td style={{ padding:"0.625rem 1rem", border:"1px solid var(--color-brand-border)", fontFamily:"var(--font-mono)", fontSize:"0.75rem", color:"var(--color-brand-muted)", whiteSpace:"nowrap" as const }}>{fTime(log.timestamp)}</td>
                    <td style={{ padding:"0.625rem 1rem", border:"1px solid var(--color-brand-border)" }}>
                      <span style={{ background:`${ACTION_COLORS[log.action]||"var(--color-brand-muted)"}22`, color:ACTION_COLORS[log.action]||"var(--color-brand-muted)", borderRadius:"20px", padding:"2px 8px", fontSize:"0.7rem", fontWeight:"700", textTransform:"uppercase" as const, whiteSpace:"nowrap" as const }}>{log.action.replace(/_/g," ")}</span>
                    </td>
                    <td style={{ padding:"0.625rem 1rem", border:"1px solid var(--color-brand-border)", fontFamily:"var(--font-mono)", fontSize:"0.8rem", color:"var(--color-brand-text)" }}>{log.item_id || "—"}</td>
                    <td style={{ padding:"0.625rem 1rem", border:"1px solid var(--color-brand-border)", fontFamily:"var(--font-mono)", fontSize:"0.7rem", color:"var(--color-brand-muted)" }}>{log.transaction_id?.slice(0,8) || "—"}...</td>
                    <td style={{ padding:"0.625rem 1rem", border:"1px solid var(--color-brand-border)", color:"var(--color-brand-text)", fontWeight:"600" }}>{log.cashier_name || "?"}</td>
                    <td style={{ padding:"0.625rem 1rem", border:"1px solid var(--color-brand-border)", color:"var(--color-brand-muted)", fontSize:"0.8rem" }}>{log.reason || "—"}</td>
                    <td style={{ padding:"0.625rem 1rem", border:"1px solid var(--color-brand-border)", fontFamily:"var(--font-mono)", fontSize:"0.75rem", color:"var(--color-brand-red)" }}>{log.old_value ? log.old_value.slice(0,20) : "—"}</td>
                    <td style={{ padding:"0.625rem 1rem", border:"1px solid var(--color-brand-border)", fontFamily:"var(--font-mono)", fontSize:"0.75rem", color:"var(--color-brand-green)" }}>{log.new_value ? log.new_value.slice(0,20) : "—"}</td>
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
