"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";

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
      description,
      discount_percentage: Number(percentage),
      bearer,
      is_active: true
    });

    if (error) alert("Gagal. Pastikan kode diskon belum pernah digunakan.");
    else {
      setCode(""); setDescription(""); setPercentage("");
      fetchDiscounts();
    }
  };

  const toggleActive = async (targetCode: string, currentStatus: boolean) => {
    await supabase.from("discount_codes").update({ is_active: !currentStatus }).eq("code", targetCode);
    fetchDiscounts();
  };

  if (!user) return null;

  return (
    <div style={{ padding: "2rem", background: "var(--color-brand-bg)", minHeight: "100vh", color: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>Manajemen Diskon</h1>
        <button onClick={() => router.push("/owner")} style={{ padding: "0.5rem 1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", cursor: "pointer" }}>← Dashboard</button>
      </div>

      <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
        
        {/* BUAT KODE BARU */}
        <div style={{ flex: 1, background: "var(--color-brand-card)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-brand-border)" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "1.5rem", color: "var(--color-brand-accent-light)" }}>+ Buat Kode Promo</h2>
          <form onSubmit={handleCreateDiscount} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input type="text" placeholder="KODE (misal: FLASH20)" value={code} onChange={e => setCode(e.target.value)} style={{ padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none", textTransform: "uppercase" }} />
            <input type="number" placeholder="Persentase Diskon (0 - 100)" min="1" max="100" value={percentage} onChange={e => setPercentage(e.target.value)} style={{ padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }} />
            
            <div>
              <label style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.5rem" }}>Siapa yang menanggung diskon?</label>
              <select value={bearer} onChange={e => setBearer(e.target.value)} style={{ width: "100%", padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }}>
                <option value="vynalee">Vynalee (Dipotong dari net profit owner)</option>
                <option value="vendor">Vendor (Dipotong merata dari harga jual barang)</option>
              </select>
            </div>

            <input type="text" placeholder="Deskripsi Opsional" value={description} onChange={e => setDescription(e.target.value)} style={{ padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }} />
            
            <button type="submit" style={{ padding: "1rem", background: "var(--color-brand-accent)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", marginTop: "0.5rem" }}>Aktifkan Kode</button>
          </form>
        </div>

        {/* DAFTAR KODE DISKON */}
        <div style={{ flex: 2, background: "var(--color-brand-card)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-brand-border)" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "1.5rem" }}>Daftar Kode Aktif</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {discounts.map(d => (
              <div key={d.code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", background: "var(--color-brand-surface)", borderRadius: "8px", borderLeft: `4px solid ${d.is_active ? "var(--color-brand-green)" : "var(--color-brand-muted)"}` }}>
                <div>
                  <h3 style={{ fontWeight: "bold", fontSize: "1.3rem", color: d.is_active ? "white" : "var(--color-brand-muted)", fontFamily: "var(--font-mono)" }}>{d.code} <span style={{ color: "var(--color-brand-yellow)", fontSize: "1rem" }}>(-{d.discount_percentage}%)</span></h3>
                  <p style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>Ditanggung oleh: <strong style={{ textTransform: "uppercase" }}>{d.bearer}</strong></p>
                  <p style={{ color: "var(--color-brand-muted)", fontSize: "0.8rem", marginTop: "0.2rem" }}>{d.description}</p>
                </div>
                <div>
                  <button onClick={() => toggleActive(d.code, d.is_active)} style={{ padding: "0.5rem 1rem", background: d.is_active ? "rgba(239,68,68,0.1)" : "var(--color-brand-green)", color: d.is_active ? "var(--color-brand-red)" : "white", border: d.is_active ? "1px solid rgba(239,68,68,0.3)" : "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
                    {d.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}