"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";

interface EventData {
  id: string;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_closed: boolean;
}

// Format ISO date (yyyy-mm-dd) → dd/mm/yyyy untuk display
const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export default function EventsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!user || user.role !== "owner") { router.replace("/login"); return; }
    fetchEvents();
  }, [user, router]);

  const fetchEvents = async () => {
    setLoading(true);
    const { data } = await supabase.from("events").select("*").order("created_at", { ascending: false });
    if (data) setEvents(data);
    setLoading(false);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate) return alert("Nama Event dan Tanggal Mulai wajib diisi!");
    const { error } = await supabase.from("events").insert({
      name, start_date: startDate, end_date: endDate || null,
      is_active: true, created_by: user?.id,
    });
    if (error) alert("Gagal membuat event.");
    else { setName(""); setStartDate(""); setEndDate(""); fetchEvents(); }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    await supabase.from("events").update({ is_active: !currentStatus }).eq("id", id);
    fetchEvents();
  };

  const closeEvent = async (id: string) => {
    if (!confirm("Tutup event ini? Setelah ditutup, event masuk ke Settlement dan tidak bisa dipakai transaksi lagi.")) return;
    await supabase.from("events").update({ is_closed: true, is_active: false, end_date: new Date().toISOString().split("T")[0] }).eq("id", id);
    fetchEvents();
  };

  if (!user) return null;

  return (
    <div className="wnp-page">
      <PageHeader title="Manajemen Event" />

      <div className="wnp-page-content">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Form Buat Event */}
          <div className="wnp-card">
            <h2 style={{ fontSize: "1.1rem", marginBottom: "1.25rem", color: "var(--color-brand-accent-light)", fontWeight: "bold" }}>
              + Buat Event Baru
            </h2>
            <form onSubmit={handleCreateEvent} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {/* Nama Event */}
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.35rem" }}>Nama Event</label>
                <input type="text" placeholder="Kota Lama Preloved #1" value={name}
                  onChange={e => setName(e.target.value)} className="wnp-input" />
              </div>

              {/* Tanggal — grid 2 kolom */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.35rem" }}>
                    Tanggal Mulai <span style={{ color: "var(--color-brand-red)" }}>*</span>
                  </label>
                  <input
                    type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="wnp-input"
                    style={{ colorScheme: "dark" }}
                  />
                  {startDate && (
                    <p style={{ fontSize: "0.75rem", color: "var(--color-brand-accent-light)", marginTop: "0.25rem" }}>
                      📅 {fmtDate(startDate)}
                    </p>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", display: "block", marginBottom: "0.35rem" }}>
                    Tanggal Selesai (Opsional)
                  </label>
                  <input
                    type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="wnp-input" min={startDate}
                    style={{ colorScheme: "dark" }}
                  />
                  {endDate && (
                    <p style={{ fontSize: "0.75rem", color: "var(--color-brand-accent-light)", marginTop: "0.25rem" }}>
                      📅 {fmtDate(endDate)}
                    </p>
                  )}
                </div>
              </div>

              <button type="submit" className="wnp-btn wnp-btn-primary" style={{ marginTop: "0.25rem" }}>
                Simpan Event
              </button>
            </form>
          </div>

          {/* Daftar Event */}
          <div className="wnp-card">
            <h2 style={{ fontSize: "1.1rem", marginBottom: "1.25rem", fontWeight: "bold" }}>
              Daftar Event ({events.length})
            </h2>
            {loading ? (
              <p style={{ color: "var(--color-brand-muted)", textAlign: "center", padding: "1rem" }}>Memuat...</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {events.length === 0 && (
                  <p style={{ color: "var(--color-brand-muted)", textAlign: "center", padding: "1.5rem" }}>Belum ada event.</p>
                )}
                {events.map(ev => (
                  <div key={ev.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "0.85rem 1rem", background: "var(--color-brand-surface)", borderRadius: "8px",
                    borderLeft: `4px solid ${ev.is_closed ? "var(--color-brand-muted)" : ev.is_active ? "var(--color-brand-green)" : "var(--color-brand-red)"}`,
                    gap: "0.75rem", flexWrap: "wrap",
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3 style={{ fontWeight: "bold", fontSize: "1rem" }}>{ev.name}</h3>
                      <p style={{ color: "var(--color-brand-muted)", fontSize: "0.8rem", marginTop: "0.15rem" }}>
                        {fmtDate(ev.start_date)}
                        {ev.end_date ? ` — ${fmtDate(ev.end_date)}` : ""}
                      </p>
                      <div style={{ marginTop: "0.4rem" }}>
                        {ev.is_closed ? (
                          <span className="wnp-badge wnp-badge-gray">CLOSED — Menunggu Settlement</span>
                        ) : (
                          <span className={`wnp-badge ${ev.is_active ? "wnp-badge-green" : "wnp-badge-red"}`}>
                            {ev.is_active ? "AKTIF" : "NONAKTIF"}
                          </span>
                        )}
                      </div>
                    </div>

                    {!ev.is_closed && (
                      <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                        <button
                          onClick={() => toggleActive(ev.id, ev.is_active)}
                          className={`wnp-btn ${ev.is_active ? "wnp-btn-ghost" : "wnp-btn-success"}`}
                          style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}
                        >
                          {ev.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          onClick={() => closeEvent(ev.id)}
                          className="wnp-btn wnp-btn-danger"
                          style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}
                        >
                          Tutup Event
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Override date input color scheme for light mode */}
      <style>{`
        input[type="date"] { color: var(--color-brand-text); }
        [data-theme="light"] input[type="date"] { color-scheme: light; }
      `}</style>
    </div>
  );
}