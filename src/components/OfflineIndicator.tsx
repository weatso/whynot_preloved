"use client";
import { useState, useEffect } from "react";
import { useCartStore } from "@/lib/store";

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const { pendingTransactions, retryPending } = useCartStore();

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const up = () => { setIsOnline(true); retryPending(); };
    const down = () => setIsOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, [retryPending]);

  if (isOnline && pendingTransactions.length === 0) return null;

  return (
    <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
      {!isOnline && (
        <div style={{ background:"rgba(239,68,68,0.15)", border:"1px solid var(--color-brand-red)", borderRadius:"20px", padding:"3px 10px", fontSize:"0.75rem", color:"var(--color-brand-red)", fontWeight:"600", display:"flex", alignItems:"center", gap:"0.4rem" }}>
          <span style={{ width:"7px", height:"7px", borderRadius:"50%", background:"var(--color-brand-red)", display:"inline-block" }}/>
          OFFLINE
        </div>
      )}
      {pendingTransactions.length > 0 && (
        <div title={`${pendingTransactions.length} transaksi pending sync`} style={{ background:"rgba(245,158,11,0.15)", border:"1px solid var(--color-brand-yellow)", borderRadius:"20px", padding:"3px 10px", fontSize:"0.75rem", color:"var(--color-brand-yellow)", fontWeight:"600" }}>
          ⏳ {pendingTransactions.length} Pending
        </div>
      )}
    </div>
  );
}
