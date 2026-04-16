"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";

export default function UsersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);

  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("kasir");

  useEffect(() => {
    if (!user || user.role !== "owner") router.replace("/login");
    else fetchUsers();
  }, [user, router]);

  const fetchUsers = async () => {
    const { data } = await supabase.from("users").select("*").order("role", { ascending: false });
    if (data) setUsers(data);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !pin || !name) return alert("Semua field wajib diisi!");
    if (pin.length !== 4) return alert("PIN harus 4 digit angka!");
    const { error } = await supabase.from("users").insert({ username: username.toLowerCase().trim(), pin, name, role, is_active: true });
    if (error) alert("Username sudah digunakan.");
    else { setUsername(""); setPin(""); setName(""); setRole("kasir"); fetchUsers(); }
  };

  const toggleStatus = async (id: string, currentStatus: boolean, userRole: string) => {
    if (userRole === "owner") return alert("Akun Owner tidak bisa dinonaktifkan!");
    await supabase.from("users").update({ is_active: !currentStatus }).eq("id", id);
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
                <input type="text" placeholder="Username (tanpa spasi)" value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase())} className="wnp-input" />
                <input type="text" placeholder="PIN 4 Digit" maxLength={4} value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ""))} className="wnp-input"
                  style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.2em" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem" }}>
                <input type="text" placeholder="Nama Lengkap" value={name}
                  onChange={e => setName(e.target.value)} className="wnp-input" />
                <select value={role} onChange={e => setRole(e.target.value)} className="wnp-input">
                  <option value="kasir">Kasir</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" className="wnp-btn wnp-btn-primary" style={{ marginTop: "0.25rem" }}>Buat Akun</button>
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