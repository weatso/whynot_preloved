"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuthStore();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"username" | "pin">("username");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) router.replace(user.role === "owner" ? "/owner" : "/kasir");
  }, [user, router]);

  useEffect(() => { if (step === "username") usernameRef.current?.focus(); }, [step]);

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setStep("pin");
    setPin("");
    setError("");
  };

  const handlePinKey = async (digit: string) => {
    if (digit === "DEL") { setPin((p) => p.slice(0, -1)); return; }
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 4) {
      setLoading(true);
      const { success, error: err } = await login(username.trim(), newPin);
      setLoading(false);
      if (success) {
        const role = useAuthStore.getState().user?.role;
        router.replace(role === "owner" ? "/owner" : "/kasir");
      } else {
        setShake(true);
        setError(err || "Login gagal");
        setTimeout(() => { setPin(""); setShake(false); }, 800);
      }
    }
  };

  const S = {
    page: { minHeight:"100vh", background:"var(--color-brand-bg)", display:"flex", flexDirection:"column" as const, alignItems:"center", justifyContent:"center", padding:"2rem", position:"relative" as const, overflow:"hidden" as const },
    blob1: { position:"absolute" as const, top:"-20%", left:"-10%", width:"500px", height:"500px", borderRadius:"50%", background:"radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)", pointerEvents:"none" as const },
    blob2: { position:"absolute" as const, bottom:"-20%", right:"-10%", width:"400px", height:"400px", borderRadius:"50%", background:"radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)", pointerEvents:"none" as const },
    card: { background:"var(--color-brand-card)", border:"1px solid var(--color-brand-border)", borderRadius:"var(--radius-2xl)", padding:"2.5rem", width:"100%", maxWidth:"380px", boxShadow:"0 25px 60px rgba(0,0,0,0.5)" },
  };

  return (
    <main style={S.page}>
      <div style={S.blob1}/><div style={S.blob2}/>
      <div style={{ textAlign:"center", marginBottom:"2.5rem" }}>
        <div style={{ display:"inline-flex", alignItems:"center", gap:"0.75rem", marginBottom:"0.5rem" }}>
          <div style={{ width:"48px", height:"48px", borderRadius:"14px", background:"linear-gradient(135deg, var(--color-brand-accent), var(--color-brand-green))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.5rem" }}>🏷️</div>
          <span style={{ fontSize:"2rem", fontWeight:"700", background:"linear-gradient(135deg, var(--color-brand-accent-light), var(--color-brand-green))", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", letterSpacing:"-0.03em" }}>Vynalee POS</span>
        </div>
        <p style={{ color:"var(--color-brand-muted)", fontSize:"0.85rem", letterSpacing:"0.05em", textTransform:"uppercase" as const }}>Full Scale · Preloved Event</p>
      </div>
      <div style={S.card}>
        {step === "username" ? (
          <form onSubmit={handleUsernameSubmit}>
            <h1 style={{ fontSize:"1rem", fontWeight:"600", color:"var(--color-brand-muted)", marginBottom:"1.5rem", textTransform:"uppercase" as const, letterSpacing:"0.08em", textAlign:"center" as const }}>Masukkan Username</h1>
            <input ref={usernameRef} id="username-input" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="owner / kasir1 / kasir2" autoComplete="username" style={{ width:"100%", background:"var(--color-brand-surface)", border:"2px solid var(--color-brand-accent)", borderRadius:"12px", padding:"1rem 1.25rem", color:"var(--color-brand-text)", fontSize:"1.25rem", fontWeight:"700", fontFamily:"var(--font-mono)", outline:"none", letterSpacing:"0.05em", textAlign:"center" as const, marginBottom:"1.25rem" }}/>
            <button type="submit" id="btn-username-next" style={{ width:"100%", padding:"1rem", borderRadius:"var(--radius-xl)", background:"linear-gradient(135deg, var(--color-brand-accent), #5b21b6)", border:"none", color:"white", fontSize:"1rem", fontWeight:"700", cursor:"pointer", fontFamily:"var(--font-display)" }}>Lanjut →</button>
          </form>
        ) : (
          <div>
            <button onClick={() => { setStep("username"); setPin(""); setError(""); }} style={{ background:"transparent", border:"none", color:"var(--color-brand-muted)", cursor:"pointer", fontSize:"0.85rem", marginBottom:"1rem", fontFamily:"var(--font-display)" }}>← Ganti username</button>
            <div style={{ textAlign:"center" as const, marginBottom:"1rem" }}>
              <div style={{ fontSize:"0.75rem", color:"var(--color-brand-muted)", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:"0.5rem" }}>Masuk sebagai</div>
              <div style={{ fontSize:"1.1rem", fontWeight:"700", color:"var(--color-brand-accent-light)", fontFamily:"var(--font-mono)" }}>@{username}</div>
            </div>
            <h2 style={{ fontSize:"1rem", fontWeight:"600", color:"var(--color-brand-muted)", marginBottom:"1.25rem", textTransform:"uppercase" as const, letterSpacing:"0.08em", textAlign:"center" as const }}>Masukkan PIN (4 digit)</h2>
            <div className={shake ? "metric-updated" : ""} style={{ display:"flex", justifyContent:"center", gap:"1rem", marginBottom:"1.5rem" }}>
              {[0,1,2,3].map((i) => (
                <div key={i} style={{ width:"18px", height:"18px", borderRadius:"50%", background:i < pin.length ? "var(--color-brand-accent)" : "var(--color-brand-border)", transition:"background 0.15s ease", boxShadow:i < pin.length ? "0 0 12px rgba(124,58,237,0.6)" : "none" }}/>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"0.625rem" }}>
              {["1","2","3","4","5","6","7","8","9","DEL","0","✓"].map((k) => (
                <button key={k} id={`pin-${k}`} onClick={() => handlePinKey(k === "✓" ? "" : k)} disabled={loading || (k === "✓" && pin.length < 4)}
                  style={{ padding:"1.1rem", borderRadius:"var(--radius-xl)", border:"1px solid var(--color-brand-border)", background: k === "✓" ? "linear-gradient(135deg, var(--color-brand-green), var(--color-brand-green-dark))" : k === "DEL" ? "rgba(239,68,68,0.1)" : "var(--color-brand-surface)", color: k === "✓" ? "white" : k === "DEL" ? "var(--color-brand-red)" : "var(--color-brand-text)", fontSize:"1.2rem", fontWeight:"700", cursor:"pointer", fontFamily:"var(--font-display)" }}>
                  {loading && k === "✓" ? "..." : k}
                </button>
              ))}
            </div>
            {error && <p style={{ textAlign:"center" as const, color:"var(--color-brand-red)", marginTop:"1rem", fontSize:"0.9rem", fontWeight:"600" }}>{error}</p>}
          </div>
        )}
      </div>
      <p style={{ marginTop:"1.5rem", fontSize:"0.75rem", color:"var(--color-brand-border)", textAlign:"center" as const }}>Akun default: owner/5678 · kasir1/1234 · kasir2/1234</p>
    </main>
  );
}
