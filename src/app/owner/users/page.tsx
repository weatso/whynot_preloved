"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Eye, EyeOff } from "lucide-react";

export default function UsersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("kasir");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || (user.role !== "owner" && user.role !== "admin")) router.replace("/login");
    else fetchUsers();
  }, [user, router]);

  const fetchUsers = async () => {
    if (!user) return;
    const { data } = await supabase.from("users").select("*")
      .neq("role", "superadmin")
      .order("role", { ascending: false });
    if (data) setUsers(data);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !name) return alert("Semua field wajib diisi!");
    if (password.length < 8) return alert("Password minimal harus 8 karakter!");
    if (!user?.tenant_id) return alert("Sesi tidak valid. Silakan login ulang.");
    
    setLoading(true);
    try {
      // 1. Hash the password using the RPC function
      const { data: hashed, error: hError } = await supabase.rpc("hash_password", { p_plain_password: password });
      if (hError) throw hError;

      // 2. Insert the user
      const { error } = await supabase.from("users").insert({
        tenant_id: user.tenant_id,
        username: username.toLowerCase().trim(),
        password_hash: hashed,
        name: name.trim(),
        role,
        is_active: true,
      });

      if (error) {
        if (error.code === "23505") alert("Username sudah digunakan.");
        else throw error;
      } else {
        setUsername(""); setPassword(""); setName(""); setRole("kasir"); setShowPassword(false); fetchUsers();
        alert("✅ Akun berhasil dibuat!");
      }
    } catch (err: any) {
      console.error("Create user error:", err);
      alert("Gagal membuat akun: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean, userRole: string) => {
    if (userRole === "owner") return alert("Akun Owner tidak bisa dinonaktifkan!");
    const { error } = await supabase.from("users").update({ is_active: !currentStatus }).eq("id", id);
    if (error) alert("Gagal mengubah status: " + error.message);
    fetchUsers();
  };

  if (!user) return null;

  const roleBadge = (r: string) => {
    if (r === "owner") return "wnp-badge-purple";
    if (r === "admin") return "wnp-badge-yellow";
    return "wnp-badge-green";
  };

  return (
    <div className="wnp-page">
      <PageHeader title="Master Data Akun" />

      <div className="wnp-page-content">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Form Buat Akun */}
          <div className="wnp-card">
            <h2 style={{ fontSize: "1.1rem", marginBottom: "1.25rem", color: "var(--color-brand-accent-light)", fontWeight: "bold" }}>
              + Buat Akun Baru
            </h2>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.3rem" }}>Username</label>
                  <input type="text" placeholder="contoh: budi_kasir" value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase())} className="wnp-input" required disabled={loading} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.3rem" }}>Password</label>
                  <div style={{ position: "relative" }}>
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Minimal 8 karakter" value={password}
                      onChange={e => setPassword(e.target.value)} 
                      className="wnp-input" 
                      required disabled={loading} 
                      style={{ 
                        width: "100%",
                        paddingRight: "2.5rem",
                        letterSpacing: showPassword ? "normal" : "0.1em"
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
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
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.3rem" }}>Nama Lengkap</label>
                  <input type="text" placeholder="Nama Lengkap" value={name}
                    onChange={e => setName(e.target.value)} className="wnp-input" required disabled={loading} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.3rem" }}>Role</label>
                  <select value={role} onChange={e => setRole(e.target.value)} className="wnp-input" disabled={loading}>
                    <option value="kasir">Kasir</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={loading} className="wnp-btn wnp-btn-primary" style={{ marginTop: "0.25rem" }}>
                {loading ? "Memproses..." : "Buat Akun"}
              </button>
            </form>
          </div>

          {/* Daftar Pengguna */}
          <div className="wnp-card">
            <h2 style={{ fontSize: "1.1rem", marginBottom: "1.25rem", fontWeight: "bold" }}>
              Daftar Pengguna ({users.length})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {users.length === 0 && (
                <p style={{ color: "var(--color-brand-muted)", textAlign: "center", padding: "1.5rem" }}>Belum ada pengguna.</p>
              )}
              {users.map(u => (
                <div key={u.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "0.85rem 1rem", background: "var(--color-brand-surface)", borderRadius: "8px",
                  borderLeft: `4px solid ${u.is_active ? "var(--color-brand-green)" : "var(--color-brand-red)"}`,
                  gap: "0.75rem", flexWrap: "wrap",
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 style={{ fontWeight: "bold", fontSize: "1rem" }}>
                      {u.name}{" "}
                      <span style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem" }}>(@{u.username})</span>
                    </h3>
                    <div style={{ marginTop: "0.25rem" }}>
                      <span className={`wnp-badge ${roleBadge(u.role)}`} style={{ textTransform: "uppercase" }}>{u.role}</span>
                      {!u.is_active && <span className="wnp-badge wnp-badge-red" style={{ marginLeft: "0.4rem" }}>NONAKTIF</span>}
                    </div>
                  </div>
                  {u.role !== "owner" && (
                    <button
                      onClick={() => toggleStatus(u.id, u.is_active, u.role)}
                      className={`wnp-btn ${u.is_active ? "wnp-btn-danger" : "wnp-btn-success"}`}
                      style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem", flexShrink: 0 }}
                    >
                      {u.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}