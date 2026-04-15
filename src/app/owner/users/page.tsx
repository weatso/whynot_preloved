"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";

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
    
    const { error } = await supabase.from("users").insert({
      username: username.toLowerCase().trim(),
      pin,
      name,
      role,
      is_active: true
    });

    if (error) alert("Username sudah digunakan.");
    else {
      setUsername(""); setPin(""); setName(""); setRole("kasir");
      fetchUsers();
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean, userRole: string) => {
    if (userRole === "owner") return alert("Akun Owner tidak bisa dinonaktifkan!");
    await supabase.from("users").update({ is_active: !currentStatus }).eq("id", id);
    fetchUsers();
  };

  if (!user) return null;

  return (
    <div style={{ padding: "2rem", background: "var(--color-brand-bg)", minHeight: "100vh", color: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>Master Data Akun</h1>
        <button onClick={() => router.push("/owner")} style={{ padding: "0.5rem 1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", cursor: "pointer" }}>← Dashboard</button>
      </div>

      <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
        <div style={{ flex: 1, background: "var(--color-brand-card)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-brand-border)" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "1.5rem", color: "var(--color-brand-accent-light)" }}>+ Buat Akun Baru</h2>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input type="text" placeholder="Username (tanpa spasi)" value={username} onChange={e => setUsername(e.target.value.toLowerCase())} style={{ padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }} />
            <input type="text" placeholder="Nama Lengkap Kasir" value={name} onChange={e => setName(e.target.value)} style={{ padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }} />
            <input type="text" placeholder="PIN Rahasia (4 Digit)" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} style={{ padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none", fontFamily: "var(--font-mono)" }} />
            
            <select value={role} onChange={e => setRole(e.target.value)} style={{ padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }}>
              <option value="kasir">Kasir (Hanya akses POS)</option>
              <option value="admin">Admin (Supervisor Lapangan)</option>
            </select>

            <button type="submit" style={{ padding: "1rem", background: "var(--color-brand-accent)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", marginTop: "0.5rem" }}>Buat Akun</button>
          </form>
        </div>

        <div style={{ flex: 2, background: "var(--color-brand-card)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-brand-border)" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "1.5rem" }}>Daftar Pengguna Sistem</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {users.map(u => (
              <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", background: "var(--color-brand-surface)", borderRadius: "8px", borderLeft: `4px solid ${u.is_active ? "var(--color-brand-green)" : "var(--color-brand-red)"}` }}>
                <div>
                  <h3 style={{ fontWeight: "bold", fontSize: "1.1rem" }}>{u.name} <span style={{ color: "var(--color-brand-muted)", fontSize: "0.9rem" }}>({u.username})</span></h3>
                  <p style={{ color: "var(--color-brand-accent-light)", fontSize: "0.85rem", marginTop: "0.2rem", textTransform: "uppercase", fontWeight: "bold" }}>Role: {u.role}</p>
                </div>
                {u.role !== "owner" && (
                  <button onClick={() => toggleStatus(u.id, u.is_active, u.role)} style={{ padding: "0.5rem 1rem", background: u.is_active ? "var(--color-brand-surface)" : "var(--color-brand-green)", border: "1px solid var(--color-brand-border)", color: "white", borderRadius: "6px", cursor: "pointer" }}>
                    {u.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}