"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { supabase } from "@/lib/supabase";
import { formatRupiah } from "@/lib/skuGenerator";
import ShrinkageAlert from "@/components/ShrinkageAlert";
import VoidTracker from "@/components/VoidTracker";

interface Metrics { gross: number; netMargin: number; itemsSold: number; availableStock: number; }
interface Log { id: string; item_id: string; price: number; method: string; cashier: string; time: string; }

const POLL = 4000;

export default function OwnerPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [metrics, setMetrics] = useState<Metrics>({ gross:0, netMargin:0, itemsSold:0, availableStock:0 });
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulsed, setPulsed] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date|null>(null);

  useEffect(() => { if (!user) router.replace("/login"); else if (user.role !== "owner") router.replace("/kasir"); }, [user, router]);

  const pulse = () => { setPulsed(true); setTimeout(() => setPulsed(false), 600); };

  const fetchAll = useCallback(async () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const todayISO = today.toISOString();
    const [txRes, soldRes, stockRes, logRes] = await Promise.all([
      supabase.from("transactions").select("total_amount, discount_applied, transaction_items(price_at_sale, items(vendor_id, vendors(commission_rate_percentage)))").eq("status","completed").gte("created_at", todayISO),
      supabase.from("transaction_items").select("item_id, transactions!inner(created_at, status)").eq("transactions.status","completed").gte("transactions.created_at", todayISO),
      supabase.from("items").select("id",{count:"exact",head:true}).eq("status","available"),
      supabase.from("transaction_items").select("item_id, price_at_sale, transactions!inner(id,payment_method,cashier_name,created_at,status), items(price)").eq("transactions.status","completed").order("transaction_id",{ascending:false}).limit(25),
    ]);
    const gross = txRes.data?.reduce((s,t) => s + (t.total_amount||0), 0) ?? 0;
    let vendorPayout = 0;
    txRes.data?.forEach(txn => {
      type TI = {price_at_sale:number, items:{vendor_id:string|null, vendors:{commission_rate_percentage:number}|null}|null};
      const tiList = (txn.transaction_items as unknown as TI[]|null);
      tiList?.forEach(ti => {
        const rate = ti.items?.vendors?.commission_rate_percentage ?? 0;
        vendorPayout += (ti.price_at_sale || 0) * (rate / 100);
      });
    });
    const newMetrics = { gross, netMargin: gross - vendorPayout, itemsSold: soldRes.data?.length ?? 0, availableStock: stockRes.count ?? 0 };
    setMetrics(prev => { if (JSON.stringify(prev) !== JSON.stringify(newMetrics)) pulse(); return newMetrics; });
    const newLogs: Log[] = (logRes.data || []).filter(d => d.transactions).map(d => {
      const txn = Array.isArray(d.transactions) ? d.transactions[0] : d.transactions;
      return { id: txn?.id, item_id: d.item_id, price: d.price_at_sale, method: txn?.payment_method ?? "", cashier: txn?.cashier_name ?? "?", time: txn?.created_at ?? "" };
    });
    setLogs(newLogs);
    setLastUpdate(new Date());
  }, []);

  useEffect(() => { fetchAll().finally(()=>setLoading(false)); }, [fetchAll]);
  useEffect(() => { const t = setInterval(fetchAll, POLL); return () => clearInterval(t); }, [fetchAll]);

  const fTime = (iso:string) => { try { return new Date(iso).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}); } catch { return "--"; } };

  if (!user || user.role !== "owner") return null;

  const MetricCard = ({ label, value, color, icon, sub }: { label:string; value:string; color:string; icon:string; sub?:string }) => (
    <div className={pulsed?"metric-updated":""} style={{ background:"var(--color-brand-card)", border:"1px solid var(--color-brand-border)", borderRadius:"var(--radius-xl)", padding:"1.5rem", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:"-15px", right:"-15px", width:"80px", height:"80px", borderRadius:"50%", background:`radial-gradient(circle, ${color}22 0%, transparent 70%)` }}/>
      <div style={{ fontSize:"0.75rem", color:"var(--color-brand-muted)", textTransform:"uppercase" as const, letterSpacing:"0.1em", fontWeight:"600", marginBottom:"0.6rem", display:"flex", gap:"0.5rem", alignItems:"center" }}>
        <span>{icon}</span>{label}
      </div>
      <div style={{ fontSize:"2.25rem", fontWeight:"800", color, fontFamily:"var(--font-mono)", lineHeight:1, letterSpacing:"-0.02em" }}>
        {loading ? <span style={{opacity:0.3}}>—</span> : value}
      </div>
      {sub && <div style={{ fontSize:"0.75rem", color:"var(--color-brand-muted)", marginTop:"4px" }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"var(--color-brand-bg)", fontFamily:"var(--font-display)" }}>
      <header style={{ background:"var(--color-brand-surface)", borderBottom:"1px solid var(--color-brand-border)", padding:"0.875rem 1.5rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
          <span style={{ fontSize:"1.25rem" }}>📊</span>
          <div>
            <span style={{ fontWeight:"700", color:"var(--color-brand-text)" }}>Vynalee POS</span>
            <span style={{ marginLeft:"0.6rem", fontSize:"0.7rem", color:"#fbbf24", background:"rgba(251,191,36,0.15)", padding:"2px 8px", borderRadius:"20px", fontWeight:"600", textTransform:"uppercase" as const }}>OWNER</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:"0.625rem", alignItems:"center" }}>
          <button id="btn-to-generate" onClick={() => router.push("/owner/generate")} style={{ background:"linear-gradient(135deg, var(--color-brand-accent), #5b21b6)", border:"none", borderRadius:"8px", padding:"7px 14px", color:"white", cursor:"pointer", fontSize:"0.8rem", fontWeight:"600", fontFamily:"var(--font-display)" }}>🏷️ Generate SKU</button>
          <button id="btn-to-settlement" onClick={() => router.push("/owner/settlement")} style={{ background:"linear-gradient(135deg, var(--color-brand-green), var(--color-brand-green-dark))", border:"none", borderRadius:"8px", padding:"7px 14px", color:"white", cursor:"pointer", fontSize:"0.8rem", fontWeight:"600", fontFamily:"var(--font-display)" }}>📄 Settlement</button>
          <button id="btn-to-audit" onClick={() => router.push("/owner/audit")} style={{ background:"var(--color-brand-surface)", border:"1px solid var(--color-brand-border)", borderRadius:"8px", padding:"7px 14px", color:"var(--color-brand-muted)", cursor:"pointer", fontSize:"0.8rem", fontFamily:"var(--font-display)" }}>🔍 Audit</button>
          <button id="btn-logout-owner" onClick={() => { logout(); router.replace("/login"); }} style={{ background:"transparent", border:"1px solid var(--color-brand-border)", borderRadius:"8px", padding:"5px 12px", color:"var(--color-brand-muted)", cursor:"pointer", fontSize:"0.8rem", fontFamily:"var(--font-display)" }}>Keluar</button>
        </div>
      </header>

      <div style={{ maxWidth:"1280px", margin:"0 auto", padding:"1.5rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"1.5rem" }}>
          <div className="glow-active" style={{ width:"9px", height:"9px", borderRadius:"50%", background:"var(--color-brand-green)", flexShrink:0 }}/>
          <span style={{ fontSize:"0.75rem", color:"var(--color-brand-muted)", textTransform:"uppercase" as const, letterSpacing:"0.1em", fontWeight:"600" }}>Auto-refresh {POLL/1000}s</span>
          {lastUpdate && <span style={{ fontSize:"0.7rem", color:"var(--color-brand-border)" }}>· {fTime(lastUpdate.toISOString())}</span>}
          <span style={{ marginLeft:"auto", fontSize:"0.75rem", color:"var(--color-brand-border)" }}>{new Date().toLocaleDateString("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}</span>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:"1rem", marginBottom:"1.5rem" }}>
          <MetricCard label="Gross Volume Hari Ini" value={formatRupiah(metrics.gross)} color="var(--color-brand-green)" icon="💰"/>
          <MetricCard label="Net Margin Vynalee" value={formatRupiah(metrics.netMargin)} color="var(--color-brand-accent-light)" icon="📈" sub="Setelah potong hak vendor"/>
          <MetricCard label="Item Terjual" value={`${metrics.itemsSold} pcs`} color="#fbbf24" icon="📦"/>
          <MetricCard label="Sisa Stok Tersedia" value={`${metrics.availableStock} pcs`} color="var(--color-brand-muted)" icon="🏷️"/>
        </div>

        <ShrinkageAlert/>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.25rem", marginTop:"1rem" }}>
          <div style={{ background:"var(--color-brand-card)", border:"1px solid var(--color-brand-border)", borderRadius:"var(--radius-xl)", overflow:"hidden" }}>
            <div style={{ padding:"1rem 1.25rem", borderBottom:"1px solid var(--color-brand-border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontWeight:"700", fontSize:"0.95rem" }}>📋 Activity Log</span>
              <span style={{ fontSize:"0.75rem", color:"var(--color-brand-muted)" }}>25 terakhir</span>
            </div>
            <div style={{ maxHeight:"340px", overflowY:"auto" as const, padding:"0.75rem" }}>
              {loading ? <div style={{ textAlign:"center" as const, padding:"2rem", color:"var(--color-brand-muted)" }}>Memuat...</div> :
               logs.length === 0 ? <div style={{ textAlign:"center" as const, padding:"2rem", color:"var(--color-brand-muted)", fontSize:"0.9rem" }}>Belum ada transaksi hari ini</div> : (
                <div style={{ display:"flex", flexDirection:"column" as const, gap:"0.4rem" }}>
                  {logs.map((log, i) => (
                    <div key={`${log.id}-${log.item_id}-${i}`} className="log-enter" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"var(--color-brand-surface)", borderRadius:"8px", padding:"0.625rem 0.875rem" }}>
                      <div style={{ display:"flex", gap:"0.625rem", alignItems:"center" }}>
                        <div style={{ width:"30px", height:"30px", borderRadius:"6px", background:log.method==="CASH"?"rgba(16,185,129,0.15)":"rgba(124,58,237,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.875rem", flexShrink:0 }}>
                          {log.method==="CASH"?"💵":"📱"}
                        </div>
                        <div>
                          <div style={{ fontFamily:"var(--font-mono)", fontSize:"0.8rem", fontWeight:"700", color:"var(--color-brand-text)" }}>{log.item_id}</div>
                          <div style={{ fontSize:"0.7rem", color:"var(--color-brand-muted)" }}>{log.cashier}</div>
                        </div>
                      </div>
                      <div style={{ textAlign:"right" as const }}>
                        <div style={{ fontWeight:"700", color:"var(--color-brand-green)", fontSize:"0.875rem", fontFamily:"var(--font-mono)" }}>{formatRupiah(log.price)}</div>
                        <div style={{ fontSize:"0.7rem", color:"var(--color-brand-muted)" }}>{fTime(log.time)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <VoidTracker/>
        </div>
      </div>
    </div>
  );
}
