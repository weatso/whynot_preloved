"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";

export default function VendorsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [vendors, setVendors] = useState<any[]>([]);

  // Form
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [commission, setCommission] = useState("20");
  const [bank, setBank] = useState("");

  useEffect(() => {
    if (!user || user.role !== "owner") router.replace("/login");
    else fetchVendors();
  }, [user, router]);

  const fetchVendors = async () => {
    const { data } = await supabase.from("vendors").select("*").order("created_at", { ascending: false });
    if (data) setVendors(data);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name || !commission) return alert("Kode, Nama, dan Komisi wajib diisi!");
    
    const { error } = await supabase.from("vendors").insert({
      code: code.toUpperCase().trim().slice(0, 6),
      name,
      commission_rate_percentage: Number(commission),
      bank_account: bank,
      is_active: true
    });

    if (error) alert("Kode Vendor sudah ada atau format salah.");
    else {
      setCode(""); setName(""); setCommission("20"); setBank("");
      fetchVendors();
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from("vendors").update({ is_active: !currentStatus }).eq("id", id);
    fetchVendors();
  };

  if (!user) return null;

  return (
    <div style={{ padding: "2rem", background: "var(--color-brand-bg)", minHeight: "100vh", color: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>Master Data Vendor</h1>
        <button onClick={() => router.push("/owner")} style={{ padding: "0.5rem 1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", cursor: "pointer" }}>← Dashboard</button>
      </div>

      <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
        <div style={{ flex: 1, background: "var(--color-brand-card)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-brand-border)" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "1.5rem", color: "var(--color-brand-accent-light)" }}>+ Tambah Vendor</h2>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input type="text" placeholder="Kode Vendor (Max 6 Huruf, misal: AGNA)" maxLength={6} value={code} onChange={e => setCode(e.target.value.toUpperCase())} style={{ padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none", textTransform: "uppercase" }} />
            <input type="text" placeholder="Nama Vendor / Brand" value={name} onChange={e => setName(e.target.value)} style={{ padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }} />
            <div>
              <label style={{ fontSize: "0.85rem", color: "var(--color-brand-muted)" }}>Komisi Vynalee (%)</label>
              <input type="number" min="0" max="100" value={commission} onChange={e => setCommission(e.target.value)} style={{ width: "100%", padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none", marginTop: "0.5rem" }} />
            </div>
            <input type="text" placeholder="Info Rekening Bank (Opsional)" value={bank} onChange={e => setBank(e.target.value)} style={{ padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }} />
            <button type="submit" style={{ padding: "1rem", background: "var(--color-brand-accent)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", marginTop: "0.5rem" }}>Simpan Vendor</button>
          </form>
        </div>

        <div style={{ flex: 2, background: "var(--color-brand-card)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-brand-border)" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "1.5rem" }}>Daftar Mitra Konsinyasi</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {vendors.map(v => (
              <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", background: "var(--color-brand-surface)", borderRadius: "8px", borderLeft: `4px solid ${v.is_active ? "var(--color-brand-green)" : "var(--color-brand-red)"}` }}>
                <div>
                  <h3 style={{ fontWeight: "bold", fontSize: "1.1rem" }}>{v.name} <span style={{ color: "var(--color-brand-muted)", fontSize: "0.9rem" }}>({v.code})</span></h3>
                  <p style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>Komisi: {v.commission_rate_percentage}% | Rek: {v.bank_account || "-"}</p>
                </div>
                <button onClick={() => toggleStatus(v.id, v.is_active)} style={{ padding: "0.5rem 1rem", background: v.is_active ? "var(--color-brand-surface)" : "var(--color-brand-green)", border: "1px solid var(--color-brand-border)", color: "white", borderRadius: "6px", cursor: "pointer" }}>
                  {v.is_active ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}