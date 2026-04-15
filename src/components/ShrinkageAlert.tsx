"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { formatRupiah } from "@/lib/skuGenerator";

interface ShrinkageItem { id: string; price: number; updated_at: string; }

export default function ShrinkageAlert() {
  const [items, setItems] = useState<ShrinkageItem[]>([]);

  const fetch = useCallback(async () => {
    const threshold = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("items")
      .select("id, price, updated_at")
      .eq("status", "in_cart")
      .lt("updated_at", threshold)
      .order("updated_at", { ascending: true })
      .limit(20);
    setItems(data || []);
  }, []);

  useEffect(() => { fetch(); const t = setInterval(fetch, 30000); return () => clearInterval(t); }, [fetch]);

  if (items.length === 0) return null;

  const minutesAgo = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60000);

  return (
    <div className="glow-red" style={{ background:"rgba(239,68,68,0.08)", border:"2px solid var(--color-brand-red)", borderRadius:"var(--radius-xl)", padding:"1.25rem", marginBottom:"1.5rem" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"1rem" }}>
        <span style={{ fontSize:"1.25rem" }}>🚨</span>
        <span style={{ fontWeight:"700", color:"var(--color-brand-red)", fontSize:"1rem" }}>Shrinkage Alert — {items.length} Item Tertahan di Keranjang</span>
        <span style={{ fontSize:"0.75rem", color:"var(--color-brand-muted)", marginLeft:"auto" }}>Update tiap 30d</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column" as const, gap:"0.4rem", maxHeight:"200px", overflowY:"auto" as const }}>
        {items.map((item) => (
          <div key={item.id} style={{ display:"flex", justifyContent:"space-between", background:"rgba(239,68,68,0.05)", borderRadius:"8px", padding:"0.6rem 0.875rem", alignItems:"center" }}>
            <span style={{ fontFamily:"var(--font-mono)", fontWeight:"700", fontSize:"0.9rem", color:"var(--color-brand-text)" }}>{item.id}</span>
            <div style={{ display:"flex", gap:"1rem", alignItems:"center" }}>
              <span style={{ color:"var(--color-brand-red)", fontWeight:"600", fontSize:"0.85rem" }}>{minutesAgo(item.updated_at)} menit lalu</span>
              <span style={{ color:"var(--color-brand-muted)", fontSize:"0.85rem", fontFamily:"var(--font-mono)" }}>{formatRupiah(item.price)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
