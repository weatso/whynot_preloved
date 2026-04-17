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
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [commission, setCommission] = useState("20");
  const [bankName, setBankName] = useState("");     // Nama Bank
  const [bankNumber, setBankNumber] = useState(""); // Nomor Rekening

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
    const bankAccount = bankName && bankNumber ? `${bankName}|${bankNumber}` : (bankName || bankNumber || "");
    const { error } = await supabase.from("vendors").insert({
      code: code.toUpperCase().trim().slice(0, 6),
      name, commission_rate_percentage: Number(commission),
      bank_account: bankAccount, is_active: true,
    });
    if (error) alert("Kode Vendor sudah ada atau format salah.");
    else { setCode(""); setName(""); setCommission("20"); setBankName(""); setBankNumber(""); fetchVendors(); }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from("vendors").update({ is_active: !currentStatus }).eq("id", id);
    fetchVendors();
  };

  // Parse bank_account field: format "BANK|NOMOR" atau lama "teks bebas"
  const parseBank = (raw: string | null) => {
    if (!raw) return { bank: "", number: "" };
    if (raw.includes("|")) {
      const [bank, number] = raw.split("|");
      return { bank, number };
    }
    return { bank: "", number: raw }; // backward compatibility
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(`✓ ${label} disalin!`);
      setTimeout(() => setCopyFeedback(null), 2000);
    });
  };

  if (!user) return null;

  return (
    <div className="wnp-page">
      <PageHeader title="Master Data Vendor" />

      {/* Copy Feedback Toast */}
      {copyFeedback && (
        <div style={{
          position: "fixed", bottom: "1.5rem", left: "50%", transform: "translateX(-50%)",
          background: "var(--color-brand-green-dark)", color: "white",
          padding: "0.6rem 1.25rem", borderRadius: "999px", fontWeight: "bold",
          fontSize: "0.9rem", zIndex: 200, pointerEvents: "none",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}>
          {copyFeedback}
        </div>
      )}

      <div className="wnp-page-content">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Form Tambah Vendor */}
          <div className="wnp-card">
            <h2 style={{ fontSize: "1.1rem", marginBottom: "1.25rem", color: "var(--color-brand-accent-light)", fontWeight: "bold" }}>
              + Tambah Vendor
            </h2>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.35rem" }}>Kode (Max 6 huruf)</label>
                  <input type="text" placeholder="AGNA" maxLength={6} value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())} className="wnp-input" />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.35rem" }}>Nama Vendor / Brand</label>
                  <input type="text" placeholder="Toko Agnes Collection" value={name}
                    onChange={e => setName(e.target.value)} className="wnp-input" />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.35rem" }}>Komisi Vynalee (%)</label>
                <input type="number" min="0" max="100" value={commission}
                  onChange={e => setCommission(e.target.value)} className="wnp-input" style={{ maxWidth: "120px" }} />
              </div>

              {/* Rekening dipisah 2 field */}
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.35rem" }}>
                  Rekening Bank (Opsional)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.75rem" }}>
                  <input type="text" placeholder="BCA / BRI / Mandiri / DANA…" value={bankName}
                    onChange={e => setBankName(e.target.value)} className="wnp-input" />
                  <input type="text" placeholder="Nomor Rekening / No. HP" value={bankNumber}
                    onChange={e => setBankNumber(e.target.value)} className="wnp-input" style={{ fontFamily: "var(--font-mono)" }} />
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
              {vendors.map(v => {
                const { bank, number } = parseBank(v.bank_account);
                return (
                  <div key={v.id} style={{
                    padding: "0.85rem 1rem", background: "var(--color-brand-surface)", borderRadius: "8px",
                    borderLeft: `4px solid ${v.is_active ? "var(--color-brand-green)" : "var(--color-brand-red)"}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h3 style={{ fontWeight: "bold", fontSize: "1rem" }}>
                          {v.name} <span style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem" }}>({v.code})</span>
                        </h3>
                        <p style={{ color: "var(--color-brand-muted)", fontSize: "0.8rem", marginTop: "0.15rem" }}>
                          Komisi: {v.commission_rate_percentage}%
                        </p>

                        {/* Rekening — tampilkan sebagai tombol copy */}
                        {(bank || number) && (
                          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                            {bank && (
                              <button
                                onClick={() => copyToClipboard(bank, "Nama Bank")}
                                style={{
                                  padding: "0.3rem 0.7rem", background: "rgba(124,58,237,0.12)",
                                  border: "1px solid var(--color-brand-accent)", color: "var(--color-brand-accent-light)",
                                  borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "bold",
                                }}
                              >
                                📋 {bank}
                              </button>
                            )}
                            {number && (
                              <button
                                onClick={() => copyToClipboard(number, "Nomor Rekening")}
                                style={{
                                  padding: "0.3rem 0.7rem", background: "rgba(16,185,129,0.1)",
                                  border: "1px solid var(--color-brand-green)", color: "var(--color-brand-green)",
                                  borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "bold",
                                  fontFamily: "var(--font-mono)",
                                }}
                              >
                                📋 {number}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => toggleStatus(v.id, v.is_active)}
                        className={`wnp-btn ${v.is_active ? "wnp-btn-danger" : "wnp-btn-success"}`}
                        style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem", flexShrink: 0 }}
                      >
                        {v.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}