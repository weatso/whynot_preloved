"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";

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

  // Form State
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");

  useEffect(() => {
    if (!user || user.role !== "owner") {
      router.replace("/login");
      return;
    }
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
    
    const { error } = await supabase.from("events").insert({
      name,
      location,
      start_date: startDate,
      is_active: true,
      created_by: user?.id,
    });

    if (error) alert("Gagal membuat event.");
    else {
      setName(""); setLocation(""); setStartDate("");
      fetchEvents();
    }
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
    <div style={{ padding: "2rem", background: "var(--color-brand-bg)", minHeight: "100vh", color: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>Manajemen Event</h1>
        <button onClick={() => router.push("/owner")} style={{ padding: "0.5rem 1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", cursor: "pointer" }}>← Kembali ke Dashboard</button>
      </div>

      <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
        {/* Kolom Kiri: Buat Event */}
        <div style={{ flex: 1, background: "var(--color-brand-card)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-brand-border)" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "1.5rem", color: "var(--color-brand-accent-light)" }}>+ Buat Event Baru</h2>
          <form onSubmit={handleCreateEvent} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input type="text" placeholder="Nama Event (misal: Kota Lama #1)" value={name} onChange={e => setName(e.target.value)} style={{ padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }} />
            <input type="text" placeholder="Lokasi" value={location} onChange={e => setLocation(e.target.value)} style={{ padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }} />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: "1rem", background: "var(--color-brand-surface)", color: "white", border: "1px solid var(--color-brand-border)", borderRadius: "8px", outline: "none" }} />
            <button type="submit" style={{ padding: "1rem", background: "var(--color-brand-accent)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", marginTop: "0.5rem" }}>Simpan Event</button>
          </form>
        </div>

        {/* Kolom Kanan: Daftar Event */}
        <div style={{ flex: 2, background: "var(--color-brand-card)", padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-brand-border)" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "1.5rem" }}>Daftar Event</h2>
          {loading ? <p>Memuat...</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {events.map(ev => (
                <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", background: "var(--color-brand-surface)", borderRadius: "8px", borderLeft: `4px solid ${ev.is_closed ? "var(--color-brand-muted)" : ev.is_active ? "var(--color-brand-green)" : "var(--color-brand-red)"}` }}>
                  <div>
                    <h3 style={{ fontWeight: "bold", fontSize: "1.1rem" }}>{ev.name}</h3>
                    <p style={{ color: "var(--color-brand-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>{ev.location} • Mulai: {ev.start_date}</p>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                      {ev.is_closed ? (
                        <span style={{ fontSize: "0.75rem", background: "rgba(100,116,139,0.2)", color: "var(--color-brand-muted)", padding: "2px 8px", borderRadius: "4px" }}>CLOSED (Menunggu Settlement)</span>
                      ) : (
                        <span style={{ fontSize: "0.75rem", background: ev.is_active ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)", color: ev.is_active ? "var(--color-brand-green)" : "var(--color-brand-red)", padding: "2px 8px", borderRadius: "4px" }}>
                          {ev.is_active ? "AKTIF" : "NONAKTIF"}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {!ev.is_closed && (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => toggleActive(ev.id, ev.is_active)} style={{ padding: "0.5rem 1rem", background: ev.is_active ? "var(--color-brand-surface)" : "var(--color-brand-green)", border: "1px solid var(--color-brand-border)", color: "white", borderRadius: "6px", cursor: "pointer" }}>
                        {ev.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button onClick={() => closeEvent(ev.id)} style={{ padding: "0.5rem 1rem", background: "rgba(239,68,68,0.2)", border: "1px solid var(--color-brand-red)", color: "var(--color-brand-red)", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
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
  );
}