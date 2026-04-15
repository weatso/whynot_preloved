"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuthStore();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace(user.role === "owner" ? "/owner" : "/kasir");
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !pin.trim()) {
      setError("Username dan PIN wajib diisi");
      return;
    }
    
    setLoading(true);
    setError("");
    const { success, error: err } = await login(username.trim(), pin.trim());
    setLoading(false);
    
    if (success) {
      const role = useAuthStore.getState().user?.role;
      router.replace(role === "owner" ? "/owner" : "/kasir");
    } else {
      setError(err || "Login gagal");
      setPin(""); // Kosongkan PIN jika gagal
    }
  };

  const S = {
    page: { minHeight:"100vh", background:"var(--color-brand-bg)", display:"flex", flexDirection:"column" as const, alignItems:"center", justifyContent:"center", padding:"2rem" },
    card: { background:"var(--color-brand-card)", border:"1px solid var(--color-brand-border)", borderRadius:"var(--radius-2xl)", padding:"2.5rem", width:"100%", maxWidth:"380px" },
    input: { width:"100%", background:"var(--color-brand-surface)", border:"1px solid var(--color-brand-border)", borderRadius:"12px", padding:"1rem", color:"var(--color-brand-text)", fontSize:"1rem", outline:"none", marginBottom:"1rem" },
    btn: { width:"100%", padding:"1rem", borderRadius:"12px", background:"var(--color-brand-accent)", border:"none", color:"white", fontSize:"1rem", fontWeight:"700", cursor:"pointer", marginTop:"1rem" }
  };

  return (
    <main style={S.page}>
      <div style={{ textAlign:"center", marginBottom:"2.5rem" }}>
        <h1 style={{ fontSize:"2rem", fontWeight:"700", color:"white" }}>Why Not Preloved</h1>
        <p style={{ color:"var(--color-brand-muted)", fontSize:"0.85rem", marginTop:"0.5rem", letterSpacing:"0.05em", textTransform:"uppercase" }}>Sistem Kasir Operasional</p>
      </div>
      
      <div style={S.card}>
        <form onSubmit={handleSubmit}>
          <label style={{ display:"block", marginBottom:"0.5rem", color:"var(--color-brand-muted)", fontSize:"0.85rem" }}>Username</label>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            placeholder="Ketik username..." 
            style={S.input}
            disabled={loading}
            autoFocus
          />

          <label style={{ display:"block", marginBottom:"0.5rem", color:"var(--color-brand-muted)", fontSize:"0.85rem" }}>PIN (4 Digit)</label>
          <input 
            type="password" 
            value={pin} 
            onChange={(e) => setPin(e.target.value)} 
            placeholder="****" 
            style={S.input}
            maxLength={4}
            disabled={loading}
          />

          {error && <p style={{ color:"var(--color-brand-red)", fontSize:"0.85rem", textAlign:"center", marginTop:"0.5rem" }}>{error}</p>}

          <button type="submit" style={{ ...S.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? "Memproses..." : "Masuk Sistem"}
          </button>
        </form>
      </div>
    </main>
  );
}