"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Eye, EyeOff } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tenant settings state
  const [shopName, setShopName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState(false);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantMsg, setTenantMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    if (user.role !== "owner" && user.role !== "admin") { router.replace("/login"); return; }
    fetchTenantSettings();
  }, [user, router]);

  const fetchTenantSettings = async () => {
    if (!user?.tenant_id) return;
    const { data } = await supabase
      .from("tenants")
      .select("name, logo_url")
      .eq("id", user.tenant_id)
      .single();
    if (data) {
      setShopName(data.name || "");
      const url = (data as any).logo_url || "";
      setLogoUrl(url);
      setLogoPreview(url);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setLogoPreview(objectUrl);
    setTenantMsg(null);
  };

  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenant_id) return;
    setTenantLoading(true);
    setTenantMsg(null);

    let finalLogoUrl = logoUrl;

    if (logoFile) {
      setUploadProgress(true);
      const ext = logoFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${user.tenant_id}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("tenant-logos")
        .upload(filePath, logoFile, { upsert: true, contentType: logoFile.type });

      if (uploadError) {
        setTenantMsg({ type: "error", text: "Upload gagal: " + uploadError.message });
        setTenantLoading(false);
        setUploadProgress(false);
        return;
      }

      const { data: publicData } = supabase.storage
        .from("tenant-logos")
        .getPublicUrl(filePath);
      finalLogoUrl = publicData.publicUrl;
      setLogoUrl(finalLogoUrl);
      setUploadProgress(false);
    }

    const { error } = await supabase
      .from("tenants")
      .update({ name: shopName.trim(), logo_url: finalLogoUrl || null })
      .eq("id", user.tenant_id);

    if (error) {
      setTenantMsg({ type: "error", text: "Gagal menyimpan: " + error.message });
    } else {
      setLogoFile(null);
      setTenantMsg({ type: "success", text: "✅ Pengaturan Akun berhasil disimpan!" });
    }
    setTenantLoading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);

    if (newPassword.length < 8) return setPassMsg({ type: "error", text: "Password baru minimal 8 karakter." });
    if (newPassword !== confirmPassword) return setPassMsg({ type: "error", text: "Konfirmasi password tidak cocok." });
    if (newPassword === currentPassword) return setPassMsg({ type: "error", text: "Password baru tidak boleh sama dengan password lama." });

    setPassLoading(true);
    try {
      const { data: me } = await supabase
        .from("users")
        .select("password_hash")
        .eq("id", user!.id)
        .single();

      if (!me) throw new Error("User tidak ditemukan.");

      const storedHash: string = me.password_hash ?? "";
      const { data: ok } = await supabase.rpc("verify_password", {
        p_stored_hash: storedHash,
        p_plain_password: currentPassword,
      });

      if (ok !== true) throw new Error("Password saat ini salah.");

      let newHashedValue = newPassword;
      const { data: hashResult } = await supabase.rpc("hash_password", { p_plain_password: newPassword });
      if (hashResult) newHashedValue = hashResult;

      const { error } = await supabase
        .from("users")
        .update({ password_hash: newHashedValue })
        .eq("id", user!.id);

      if (error) throw error;

      setPassMsg({ type: "success", text: "✅ Password Akun berhasil diubah!" });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setShowCurrent(false); setShowNew(false); setShowConfirm(false);
    } catch (err: any) {
      setPassMsg({ type: "error", text: err.message || "Gagal mengubah password." });
    } finally {
      setPassLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.8rem 1rem",
    background: "var(--color-brand-surface)",
    border: "1px solid var(--color-brand-border)",
    borderRadius: "8px", color: "var(--color-brand-text)",
    outline: "none", fontSize: "0.95rem",
    boxSizing: "border-box",
  };

  const msgBox = (msg: { type: "success" | "error"; text: string }) => (
    <div style={{
      padding: "0.7rem 1rem", borderRadius: "8px", fontSize: "0.85rem", fontWeight: "bold",
      background: msg.type === "success" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
      color: msg.type === "success" ? "var(--color-brand-green)" : "var(--color-brand-red)",
      border: `1px solid ${msg.type === "success" ? "var(--color-brand-green)" : "var(--color-brand-red)"}`,
    }}>
      {msg.text}
    </div>
  );

  return (
    <div className="wnp-page">
      <PageHeader title="Pengaturan Akun" />

      <div className="wnp-page-content">
        <div style={{
          maxWidth: "640px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          width: "100%",
        }}>

          {/* ── Tenant / Shop Identity ── */}
          <div className="wnp-card">
            <h2 style={{ fontSize: "1.1rem", fontWeight: "bold", color: "var(--color-brand-accent-light)", marginBottom: "0.35rem" }}>
              🏬 Identitas Toko
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", marginBottom: "1.25rem" }}>
              Nama dan logo toko yang tampil di header kasir dan struk.
            </p>

            <form onSubmit={handleSaveTenant} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.35rem", fontWeight: "bold" }}>
                  Nama Toko <span style={{ color: "var(--color-brand-red)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                  placeholder="contoh: Toko Baju A"
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
                  Logo Toko (opsional)
                </label>

                <div style={{
                  display: "flex", alignItems: "center", gap: "1rem",
                  padding: "0.85rem", marginBottom: "0.75rem",
                  background: "var(--color-brand-surface)",
                  border: "1px solid var(--color-brand-border)",
                  borderRadius: "10px",
                }}>
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      style={{ height: "56px", width: "56px", borderRadius: "8px", objectFit: "contain", background: "white", flexShrink: 0 }}
                      onError={e => { e.currentTarget.style.display = "none"; }}
                    />
                  ) : (
                    <div style={{
                      height: "56px", width: "56px", borderRadius: "8px",
                      background: "var(--color-brand-bg)",
                      border: "2px dashed var(--color-brand-border)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "1.5rem", flexShrink: 0,
                    }}>🏬</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: "bold", color: "var(--color-brand-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {logoFile ? logoFile.name : logoUrl ? "Logo saat ini" : "Belum ada logo"}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--color-brand-muted)", marginTop: "0.15rem" }}>
                      {logoFile ? `${(logoFile.size / 1024).toFixed(0)} KB` : "PNG, JPG, WebP — maks. 2 MB"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: "var(--color-brand-accent)", color: "white",
                      border: "none", padding: "0.5rem 1rem", borderRadius: "8px",
                      cursor: "pointer", fontWeight: "bold", fontSize: "0.82rem", flexShrink: 0,
                    }}
                  >
                    {uploadProgress ? "Mengupload..." : "📁 Pilih File"}
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />

                {logoFile && (
                  <p style={{ fontSize: "0.75rem", color: "var(--color-brand-yellow)", margin: "0 0 0.25rem 0" }}>
                    ⚠️ File baru dipilih — klik "Simpan Pengaturan Akun" untuk mengupload.
                  </p>
                )}
              </div>

              {tenantMsg && msgBox(tenantMsg)}

              <button
                type="submit"
                disabled={tenantLoading}
                className="wnp-btn wnp-btn-primary"
                style={{ marginTop: "0.25rem" }}
              >
                {tenantLoading ? (uploadProgress ? "Mengupload Logo..." : "Menyimpan...") : "Simpan Pengaturan Akun"}
              </button>
            </form>
          </div>

          {/* ── Change Password ── */}
          <div className="wnp-card">
            <h2 style={{ fontSize: "1.1rem", fontWeight: "bold", color: "var(--color-brand-accent-light)", marginBottom: "0.35rem" }}>
              🔐 Ganti Password Akun
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", marginBottom: "1.25rem" }}>
              Akun: <strong style={{ color: "var(--color-brand-text)" }}>{user.name}</strong>
              <span style={{ color: "var(--color-brand-muted)" }}> (@{user.username})</span>
            </p>

            <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.35rem", fontWeight: "bold" }}>
                  Password Saat Ini
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ 
                      ...inputStyle, 
                      fontFamily: showCurrent ? "inherit" : "var(--font-mono)", 
                      letterSpacing: showCurrent ? "normal" : "0.1em",
                      paddingRight: "2.5rem"
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "var(--color-brand-muted)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.35rem", fontWeight: "bold" }}>Password Baru</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showNew ? "text" : "password"}
                      value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      placeholder="Minimal 8 karakter"
                      style={{ 
                        ...inputStyle, 
                        fontFamily: showNew ? "inherit" : "var(--font-mono)", 
                        letterSpacing: showNew ? "normal" : "0.1em",
                        paddingRight: "2.5rem"
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      style={{
                        position: "absolute",
                        right: "0.75rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "var(--color-brand-muted)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.35rem", fontWeight: "bold" }}>Konfirmasi Password Baru</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{ 
                        ...inputStyle, 
                        fontFamily: showConfirm ? "inherit" : "var(--font-mono)", 
                        letterSpacing: showConfirm ? "normal" : "0.1em",
                        paddingRight: "2.5rem"
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      style={{
                        position: "absolute",
                        right: "0.75rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "var(--color-brand-muted)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {newPassword.length > 0 && (
                <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                  {[1,2,3,4,5,6,7,8].map(i => (
                    <div key={i} style={{
                      flex: 1, height: "4px", borderRadius: "4px",
                      background: i <= newPassword.length ? (newPassword.length >= 8 ? "var(--color-brand-green)" : "var(--color-brand-yellow)") : "var(--color-brand-border)",
                      transition: "background 0.2s",
                    }} />
                  ))}
                  <span style={{ fontSize: "0.72rem", color: "var(--color-brand-muted)", whiteSpace: "nowrap" }}>
                    {newPassword.length}/8+
                  </span>
                </div>
              )}

              {passMsg && msgBox(passMsg)}

              <button type="submit" disabled={passLoading} className="wnp-btn wnp-btn-primary">
                {passLoading ? "Memverifikasi..." : "Simpan Pengaturan Akun"}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
