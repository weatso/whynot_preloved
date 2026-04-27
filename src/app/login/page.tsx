"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const getRoleRoute = (role: string) => {
    if (role === "superadmin") return "/superadmin";
    if (role === "owner") return "/owner";
    return "/kasir";
  };

  useEffect(() => {
    if (user) router.replace(getRoleRoute(user.role));
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) { 
      setError("Username dan Password wajib diisi"); 
      return; 
    }
    setLoading(true);
    setError("");
    const result = await login(username.trim(), password.trim());
    setLoading(false);
    if (result.success && result.user) {
      router.replace(getRoleRoute(result.user.role));
    } else {
      setError(result.error || "Login gagal");
      setPassword("");
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
            Password
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"} 
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" className="wnp-input"
              disabled={loading}
              style={{ 
                fontFamily: showPassword ? "inherit" : "var(--font-mono)", 
                letterSpacing: showPassword ? "normal" : "0.1em",
                paddingRight: "2.5rem",
                width: "100%"
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
                padding: "0.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

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