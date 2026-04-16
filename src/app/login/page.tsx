"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { ThemeToggle } from "@/components/ThemeToggle";

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
    if (!username.trim() || !pin.trim()) { setError("Username dan PIN wajib diisi"); return; }
    setLoading(true);
    setError("");
    const { success, error: err } = await login(username.trim(), pin.trim());
    setLoading(false);
    if (success) {
      const role = useAuthStore.getState().user?.role;
      router.replace(role === "owner" ? "/owner" : "/kasir");
    } else {
      setError(err || "Login gagal");
      setPin("");
    }
  };

  return (
    <main style={{
      minHeight: "100vh", background: "var(--color-brand-bg)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "1.5rem", position: "relative",
    }}>
      {/* Theme Toggle */}
      <div style={{ position: "absolute", top: "1rem", right: "1rem" }}>
        <ThemeToggle />
      </div>

      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "clamp(1.5rem, 5vw, 2rem)", fontWeight: 700, color: "var(--color-brand-text)" }}>
          Why Not Preloved
        </h1>
        <p style={{
          color: "var(--color-brand-muted)", fontSize: "0.8rem", marginTop: "0.4rem",
          letterSpacing: "0.05em", textTransform: "uppercase",
        }}>
          Sistem Kasir Operasional
        </p>
      </div>

      <div style={{
        background: "var(--color-brand-card)",
        border: "1px solid var(--color-brand-border)",
        borderRadius: "var(--radius-2xl)", padding: "2rem",
        width: "100%", maxWidth: "380px",
      }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          <label style={{ color: "var(--color-brand-muted)", fontSize: "0.8rem", marginBottom: "0.4rem" }}>
            Username
          </label>
          <input
            type="text" value={username} onChange={e => setUsername(e.target.value)}
            placeholder="Ketik username..." className="wnp-input"
            disabled={loading} autoFocus
          />

          <label style={{ color: "var(--color-brand-muted)", fontSize: "0.8rem", marginTop: "0.85rem", marginBottom: "0.4rem" }}>
            PIN (4 Digit)
          </label>
          <input
            type="password" value={pin} onChange={e => setPin(e.target.value)}
            placeholder="****" className="wnp-input"
            maxLength={4} disabled={loading}
            style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.3em" }}
          />

          {error && (
            <p style={{ color: "var(--color-brand-red)", fontSize: "0.85rem", textAlign: "center", marginTop: "0.75rem" }}>
              {error}
            </p>
          )}

          <button
            type="submit" className="wnp-btn wnp-btn-primary"
            style={{ width: "100%", marginTop: "1.25rem", padding: "1rem", fontSize: "1rem" }}
            disabled={loading}
          >
            {loading ? "Memproses..." : "Masuk Sistem"}
          </button>
        </form>
      </div>
    </main>
  );
}