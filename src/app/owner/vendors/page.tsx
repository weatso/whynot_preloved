"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";

export default function VendorsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [vendors, setVendors] = useState<any[]>([]);

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
      name, commission_rate_percentage: Number(commission), bank_account: bank, is_active: true,
    });
    if (error) alert("Kode Vendor sudah ada atau format salah.");
    else { setCode(""); setName(""); setCommission("20"); setBank(""); fetchVendors(); }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from("vendors").update({ is_active: !currentStatus }).eq("id", id);
    fetchVendors();
  };

  if (!user) return null;

  return (
    <div className="wnp-page">
      <PageHeader title="Master Data Vendor" />

      <div className="wnp-page-content">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Form Tambah Vendor */}
          <div className="wnp-card">
            <h2 style={{ fontSize: "1.1rem", marginBottom: "1.25rem", color: "var(--color-brand-accent-light)", fontWeight: "bold" }}>
              + Tambah Vendor
            </h2>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.75rem" }}>
                <input type="text" placeholder="Kode (Max 6 huruf)" maxLength={6} value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())} className="wnp-input" style={{ textTransform: "uppercase" }} />
                <input type="text" placeholder="Nama Vendor / Brand" value={name}
                  onChange={e => setName(e.target.value)} className="wnp-input" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.35rem" }}>Komisi Vynalee (%)</label>
                  <input type="number" min="0" max="100" value={commission}
                    onChange={e => setCommission(e.target.value)} className="wnp-input" />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.35rem" }}>Info Rekening (Opsional)</label>
                  <input type="text" placeholder="BCA 123456789 a.n Nama" value={bank}
                    onChange={e => setBank(e.target.value)} className="wnp-input" />
                </div>
              </div>
              <button type="submit" className="wnp-btn wnp-btn-primary" style={{ marginTop: "0.25rem" }}>Simpan Vendor</button>
            </form>
          </div>

          {/* Daftar Vendor */}
          <div className="wnp-card">
            <h2 style={{ fontSize: "1.1rem", marginBottom: "1.25rem", fontWeight: "bold" }}>
              Daftar Mitra Konsinyasi ({vendors.length})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {vendors.length === 0 && (
                <p style={{ color: "var(--color-brand-muted)", textAlign: "center", padding: "1.5rem" }}>Belum ada vendor.</p>
              )}
              {vendors.map(v => (
                <div key={v.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "0.85rem 1rem", background: "var(--color-brand-surface)", borderRadius: "8px",
                  borderLeft: `4px solid ${v.is_active ? "var(--color-brand-green)" : "var(--color-brand-red)"}`,
                  gap: "0.75rem", flexWrap: "wrap",
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 style={{ fontWeight: "bold", fontSize: "1rem" }}>
                      {v.name} <span style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem" }}>({v.code})</span>
                    </h3>
                    <p style={{ color: "var(--color-brand-muted)", fontSize: "0.8rem", marginTop: "0.15rem" }}>
                      Komisi: {v.commission_rate_percentage}% | Rek: {v.bank_account || "—"}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleStatus(v.id, v.is_active)}
                    className={`wnp-btn ${v.is_active ? "wnp-btn-danger" : "wnp-btn-success"}`}
                    style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem", flexShrink: 0 }}
                  >
                    {v.is_active ? "Nonaktifkan" : "Aktifkan"}
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