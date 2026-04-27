"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { 
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from "recharts";
import { 
  TrendingUp, TrendingDown, DollarSign, Package, Users, ShoppingBag, ArrowLeft, Calendar
} from "lucide-react";

const formatIDR = (val: number) => "Rp " + (val || 0).toLocaleString("id-ID");

interface DashboardMetrics {
  grossRevenue: number;
  netProfit: number;
  itemsSold: number;
  activeVendors: number;
  prevGross: number;
  prevNet: number;
  prevItems: number;
}

export default function AnalyticsDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [range, setRange] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    grossRevenue: 0, netProfit: 0, itemsSold: 0, activeVendors: 0,
    prevGross: 0, prevNet: 0, prevItems: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [topVendors, setTopVendors] = useState<any[]>([]);
  const [topCategories, setTopCategories] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user || user.role === "kasir") {
      router.replace("/login");
      return;
    }
    fetchDashboardData();
  }, [user, range]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const currentStart = new Date();
      currentStart.setDate(now.getDate() - range);
      
      const prevStart = new Date();
      prevStart.setDate(now.getDate() - (range * 2));

      // 1. Fetch Current Period Items
      const { data: currentItems } = await supabase
        .from("transaction_items")
        .select(`
          price_at_sale, discount_applied, discount_bearer, vendor_commission_rate,
          items ( name, category, vendor_id, vendors ( name ) ),
          transactions ( created_at, status )
        `)
        .gte("transactions.created_at", currentStart.toISOString())
        .eq("transactions.status", "completed");

      // 2. Fetch Previous Period Items (for comparison)
      const { data: prevItems } = await supabase
        .from("transaction_items")
        .select(`
          price_at_sale, discount_applied, discount_bearer, vendor_commission_rate,
          transactions ( created_at, status )
        `)
        .gte("transactions.created_at", prevStart.toISOString())
        .lt("transactions.created_at", currentStart.toISOString())
        .eq("transactions.status", "completed");

      // 3. Fetch Active Vendors
      const { count: vendorCount } = await supabase
        .from("vendors")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Process Metrics
      const processPeriod = (items: any[]) => {
        let gross = 0;
        let net = 0;
        const vendorMap = new Map();
        const categoryMap = new Map();
        const dailyMap = new Map();

        items?.forEach(ti => {
          let itemGross = Number(ti.price_at_sale);
          if (ti.discount_bearer === "vynalee") {
            itemGross += Number(ti.discount_applied || 0);
          }
          const rate = Number(ti.vendor_commission_rate) || 0;
          const itemNet = Math.round(itemGross * (rate / 100)); // Store's cut

          gross += itemGross;
          net += itemNet;

          // Vendor Aggregation
          const vName = ti.items?.vendors?.name || "Unknown";
          vendorMap.set(vName, (vendorMap.get(vName) || 0) + itemGross);

          // Category Aggregation
          const cat = ti.items?.category || "Lainnya";
          categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);

          // Daily Trend
          const date = new Date(ti.transactions?.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
          dailyMap.set(date, (dailyMap.get(date) || 0) + itemGross);
        });

        return { gross, net, count: items?.length || 0, vendorMap, categoryMap, dailyMap };
      };

      const curr = processPeriod(currentItems || []);
      const prev = processPeriod(prevItems || []);

      setMetrics({
        grossRevenue: curr.gross,
        netProfit: curr.net,
        itemsSold: curr.count,
        activeVendors: vendorCount || 0,
        prevGross: prev.gross,
        prevNet: prev.net,
        prevItems: prev.count
      });

      // Chart Data Formatting
      const chartArr = [];
      for (let i = range - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateStr = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
        chartArr.push({
          name: dateStr,
          revenue: curr.dailyMap.get(dateStr) || 0
        });
      }
      setChartData(chartArr);

      // Top Performers
      setTopVendors(
        Array.from(curr.vendorMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, val]) => ({ name, value: val }))
      );

      setTopCategories(
        Array.from(curr.categoryMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, val]) => ({ name, value: val }))
      );

    } catch (err) {
      console.error("Dashboard Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const MetricCard = ({ title, value, prevValue, icon: Icon, color, isCurrency = true }: any) => {
    const pct = calculateChange(value, prevValue);
    const isUp = pct >= 0;

    return (
      <div className="wnp-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ padding: "0.5rem", borderRadius: "12px", background: `rgba(${color}, 0.1)`, color: `rgb(${color})` }}>
            <Icon size={24} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: isUp ? "var(--color-brand-green)" : "var(--color-brand-red)", fontSize: "0.85rem", fontWeight: "bold" }}>
            {isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {Math.abs(pct)}%
          </div>
        </div>
        <div style={{ marginTop: "0.5rem" }}>
          <p style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem", margin: 0 }}>{title}</p>
          <h3 style={{ fontSize: "1.8rem", fontWeight: "bold", margin: "0.25rem 0" }}>
            {isCurrency ? "Rp " + value.toLocaleString("id-ID") : value.toLocaleString("id-ID")}
          </h3>
          <p style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", margin: 0 }}>
            vs periode sebelumnya
          </p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--color-brand-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--color-brand-accent)", fontFamily: "var(--font-mono)" }}>Analysing Enterprise Data...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-brand-bg)", padding: "2rem", color: "var(--color-brand-text)" }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <button onClick={() => router.push("/owner")} style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--color-brand-muted)", background: "none", border: "none", cursor: "pointer", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
            <ArrowLeft size={16} /> Kembali ke Command Center
          </button>
          <h1 style={{ fontSize: "2.5rem", fontWeight: "900", margin: 0, letterSpacing: "-1px" }}>Executive Analytics</h1>
        </div>
        
        <div style={{ display: "flex", background: "var(--color-brand-surface)", padding: "0.25rem", borderRadius: "10px", border: "1px solid var(--color-brand-border)" }}>
          <button 
            onClick={() => setRange(7)}
            style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", border: "none", background: range === 7 ? "var(--color-brand-accent)" : "transparent", color: range === 7 ? "#fff" : "var(--color-brand-muted)", cursor: "pointer", fontWeight: "bold", transition: "0.2s" }}
          >
            7 Hari
          </button>
          <button 
            onClick={() => setRange(30)}
            style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", border: "none", background: range === 30 ? "var(--color-brand-accent)" : "transparent", color: range === 30 ? "#fff" : "var(--color-brand-muted)", cursor: "pointer", fontWeight: "bold", transition: "0.2s" }}
          >
            30 Hari
          </button>
        </div>
      </header>

      {/* Metrics Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem", marginBottom: "2.5rem" }}>
        <MetricCard title="Gross Revenue" value={metrics.grossRevenue} prevValue={metrics.prevGross} icon={DollarSign} color="34, 197, 94" />
        <MetricCard title="Net Store Profit" value={metrics.netProfit} prevValue={metrics.prevNet} icon={TrendingUp} color="59, 130, 246" />
        <MetricCard title="Items Sold" value={metrics.itemsSold} prevValue={metrics.prevItems} icon={Package} color="249, 115, 22" isCurrency={false} />
        <MetricCard title="Active Vendors" value={metrics.activeVendors} prevValue={metrics.activeVendors} icon={Users} color="168, 85, 247" isCurrency={false} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "2rem" }}>
        {/* Sales Chart */}
        <div className="wnp-card" style={{ padding: "2rem", minHeight: "450px", display: "flex", flexDirection: "column" }}>
          <h3 style={{ margin: "0 0 1.5rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Calendar size={20} color="var(--color-brand-accent)" /> Sales Performance Trend
          </h3>
          <div style={{ flex: 1, width: "100%" }}>
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-brand-accent)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-brand-accent)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--color-brand-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-brand-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `Rp${val/1000}k`} />
                  <Tooltip 
                    contentStyle={{ background: "var(--color-brand-card)", border: "1px solid var(--color-brand-border)", borderRadius: "8px" }}
                    formatter={(val: number) => ["Rp " + val.toLocaleString("id-ID"), "Revenue"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="var(--color-brand-accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Lists */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Top Vendors */}
          <div className="wnp-card" style={{ padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1.25rem 0", fontSize: "1.1rem" }}>🏆 Top 3 Vendors by Revenue</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {topVendors.map((v, i) => (
                <div key={v.name} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: i === 0 ? "gold" : i === 1 ? "silver" : "#cd7f32", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontWeight: "bold", fontSize: "0.8rem" }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold" }}>{v.name}</div>
                    <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", marginTop: "0.4rem", overflow: "hidden" }}>
                      <div style={{ width: `${(v.value / topVendors[0].value) * 100}%`, height: "100%", background: "var(--color-brand-accent)" }} />
                    </div>
                  </div>
                  <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{formatIDR(v.value)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Categories */}
          <div className="wnp-card" style={{ padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1.25rem 0", fontSize: "1.1rem" }}>🏷️ Top 5 Categories (by Item Sold)</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
              {topCategories.map((c, i) => (
                <div key={c.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--color-brand-muted)" }}>{c.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1, margin: "0 1.5rem" }}>
                    <div style={{ flex: 1, height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px" }}>
                      <div style={{ width: `${(c.value / topCategories[0].value) * 100}%`, height: "100%", background: "var(--color-brand-green)" }} />
                    </div>
                  </div>
                  <span style={{ fontWeight: "bold" }}>{c.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
