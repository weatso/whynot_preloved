"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";

export default function DiscountsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [discounts, setDiscounts] = useState<any[]>([]);

  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [percentage, setPercentage] = useState("");
  const [bearer, setBearer] = useState("vynalee");

  useEffect(() => {
    if (!user || user.role !== "owner") router.replace("/login");
    else fetchDiscounts();
  }, [user, router]);

  const fetchDiscounts = async () => {
    const { data } = await supabase.from("discount_codes").select("*").order("created_at", { ascending: false });
    if (data) setDiscounts(data);
  };

  const handleCreateDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !percentage) return alert("Kode dan Persentase wajib diisi");
    const { error } = await supabase.from("discount_codes").insert({
      code: code.toUpperCase().trim().replace(/\s/g, ""),
      description, discount_percentage: Number(percentage), bearer, is_active: true,
    });
    if (error) alert("Gagal. Pastikan kode diskon belum pernah digunakan.");
    else { setCode(""); setDescription(""); setPercentage(""); fetchDiscounts(); }
  };

  const toggleActive = async (targetCode: string, currentStatus: boolean) => {
    await supabase.from("discount_codes").update({ is_active: !currentStatus }).eq("code", targetCode);
    fetchDiscounts();
  };

  if (!user) return null;

  return (
    <div className="wnp-page">
      <PageHeader title="Manajemen Diskon" />

      <div className="wnp-page-content">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Form Buat Kode */}
          <div className="wnp-card">
            <h2 style={{ fontSize: "1.1rem", marginBottom: "1.25rem", color: "var(--color-brand-accent-light)", fontWeight: "bold" }}>
              + Buat Kode Promo
            </h2>
            <form onSubmit={handleCreateDiscount} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <input type="text" placeholder="KODE (misal: FLASH20)" value={code}
                onChange={e => setCode(e.target.value)} className="wnp-input" style={{ textTransform: "uppercase" }} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <input type="number" placeholder="Persentase (0-100)" min="1" max="100"
                  value={percentage} onChange={e => setPercentage(e.target.value)} className="wnp-input" />
                <select value={bearer} onChange={e => setBearer(e.target.value)} className="wnp-input">
                  <option value="vynalee">Ditanggung Vynalee</option>
                  <option value="vendor">Ditanggung Vendor</option>
                </select>
              </div>

              <input type="text" placeholder="Deskripsi (Opsional)" value={description}
                onChange={e => setDescription(e.target.value)} className="wnp-input" />

              <button type="submit" className="wnp-btn wnp-btn-primary" style={{ marginTop: "0.25rem" }}>
                Aktifkan Kode
              </button>
            </form>
          </div>

          {/* Daftar Kode */}
          <div className="wnp-card">
            <h2 style={{ fontSize: "1.1rem", marginBottom: "1.25rem", fontWeight: "bold" }}>
              Daftar Kode Diskon ({discounts.length})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {discounts.length === 0 && (
                <p style={{ color: "var(--color-brand-muted)", textAlign: "center", padding: "1.5rem" }}>Belum ada kode diskon.</p>
              )}
              {discounts.map(d => (
                <div key={d.code} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "0.85rem 1rem", background: "var(--color-brand-surface)", borderRadius: "8px",
                  borderLeft: `4px solid ${d.is_active ? "var(--color-brand-green)" : "var(--color-brand-muted)"}`,
                  gap: "0.75rem", flexWrap: "wrap",
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 style={{ fontWeight: "bold", fontSize: "1.1rem", color: d.is_active ? "var(--color-brand-text)" : "var(--color-brand-muted)", fontFamily: "var(--font-mono)" }}>
                      {d.code}{" "}
                      <span className="wnp-badge wnp-badge-yellow">-{d.discount_percentage}%</span>
                    </h3>
                    <p style={{ color: "var(--color-brand-muted)", fontSize: "0.8rem", marginTop: "0.15rem" }}>
                      Ditanggung: <strong style={{ textTransform: "uppercase" }}>{d.bearer}</strong>
                      {d.description && ` — ${d.description}`}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleActive(d.code, d.is_active)}
                    className={`wnp-btn ${d.is_active ? "wnp-btn-danger" : "wnp-btn-success"}`}
                    style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem", flexShrink: 0 }}
                  >
                    {d.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}