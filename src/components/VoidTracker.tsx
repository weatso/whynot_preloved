"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface VoidLog { id: string; action: string; item_id: string | null; cashier_name: string | null; reason: string | null; timestamp: string; }

export default function VoidTracker() {
  const [logs, setLogs] = useState<VoidLog[]>([]);
  const [isNew, setIsNew] = useState(false);

  const fetch = useCallback(async () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const { data } = await supabase
      .from("audit_logs")
      .select("id, action, item_id, cashier_name, reason, timestamp")
      .in("action", ["VOID_ITEM","CART_CLEAR","VOID_TRANSACTION"])
      .gte("timestamp", today.toISOString())
      .order("timestamp", { ascending: false })
      .limit(30);
    if (data && data.length !== logs.length) setIsNew(true);
    setLogs(data || []);
    setTimeout(() => setIsNew(false), 1000);
  }, [logs.length]);

  useEffect(() => { fetch(); const t = setInterval(fetch, 5000); return () => clearInterval(t); }, [fetch]);

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
  const actionColor = (a: string) => a === "VOID_TRANSACTION" ? "var(--color-brand-red)" : "var(--color-brand-orange)";
  const actionIcon = (a: string) => a === "VOID_TRANSACTION" ? "🚫" : a === "CART_CLEAR" ? "🗑️" : "✕";

  return (
    <div style={{ background:"var(--color-brand-card)", border:`1px solid ${isNew ? "var(--color-brand-red)" : "var(--color-brand-border)"}`, borderRadius:"var(--radius-xl)", overflow:"hidden", transition:"border-color 0.3s ease" }}>
      <div style={{ padding:"1rem 1.25rem", borderBottom:"1px solid var(--color-brand-border)", display:"flex", alignItems:"center", gap:"0.5rem" }}>
        <span>🔍</span>
        <span style={{ fontWeight:"700", fontSize:"0.95rem" }}>Void Tracker</span>
        {logs.length > 0 && (
          <span style={{ background:"rgba(239,68,68,0.15)", color:"var(--color-brand-red)", borderRadius:"20px", padding:"2px 10px", fontSize:"0.75rem", fontWeight:"700", marginLeft:"auto" }}>{logs.length} void hari ini</span>
        )}
      </div>
      <div style={{ maxHeight:"280px", overflowY:"auto" as const, padding:"0.75rem" }}>
        {logs.length === 0 ? (
          <div style={{ textAlign:"center" as const, padding:"2rem", color:"var(--color-brand-muted)", fontSize:"0.9rem" }}>✅ Tidak ada void hari ini</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column" as const, gap:"0.4rem" }}>
            {logs.map((log) => (
              <div key={log.id} className="log-enter" style={{ display:"flex", alignItems:"center", gap:"0.75rem", background:"var(--color-brand-surface)", borderRadius:"8px", padding:"0.625rem 0.875rem", borderLeft:`3px solid ${actionColor(log.action)}` }}>
                <span style={{ fontSize:"1rem" }}>{actionIcon(log.action)}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
                    <span style={{ fontSize:"0.75rem", fontWeight:"700", color:actionColor(log.action), textTransform:"uppercase" as const }}>{log.action.replace("_"," ")}</span>
                    {log.item_id && <span style={{ fontFamily:"var(--font-mono)", fontSize:"0.8rem", color:"var(--color-brand-text)" }}>{log.item_id}</span>}
                  </div>
                  <div style={{ fontSize:"0.75rem", color:"var(--color-brand-muted)", marginTop:"2px" }}>
                    {log.cashier_name || "Unknown"}{log.reason ? ` · ${log.reason}` : ""}
                  </div>
                </div>
                <span style={{ fontSize:"0.75rem", color:"var(--color-brand-muted)", flexShrink:0 }}>{formatTime(log.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
