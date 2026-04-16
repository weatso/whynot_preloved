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
  is_active: boolean;
  is_closed: boolean;
}

export default function EventsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");

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
    if (!name || !startDate) return alert("Nama dan Tanggal Mulai wajib diisi!");
    const { error } = await supabase.from("events").insert({ name, location, start_date: startDate, is_active: true, created_by: user?.id });
    if (error) alert("Gagal membuat event.");
    else { setName(""); setLocation(""); setStartDate(""); fetchEvents(); }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    await supabase.from("events").update({ is_active: !currentStatus }).eq("id", id);
    fetchEvents();
  };

  const closeEvent = async (id: string) => {
    if (!confirm("Tutup event ini? Setelah ditutup, event akan masuk ke Settlement dan tidak bisa dipakai transaksi lagi.")) return;
    await supabase.from("events").update({ is_closed: true, is_active: false, end_date: new Date().toISOString() }).eq("id", id);
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
              <input type="text" placeholder="Nama Event (misal: Kota Lama #1)" value={name}
                onChange={e => setName(e.target.value)} className="wnp-input" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <input type="text" placeholder="Lokasi" value={location}
                  onChange={e => setLocation(e.target.value)} className="wnp-input" />
                <input type="date" value={startDate}
                  onChange={e => setStartDate(e.target.value)} className="wnp-input" />
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
                        {ev.location} • Mulai: {ev.start_date}
                      </p>
                      <div style={{ marginTop: "0.4rem" }}>
                        {ev.is_closed ? (
                          <span className="wnp-badge wnp-badge-gray">CLOSED</span>
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
    </div>
  );
}