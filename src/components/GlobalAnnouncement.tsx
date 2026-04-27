"use client";
import { useState, useEffect } from "react";
import { getActiveBroadcasts } from "@/app/actions/superadmin";
import { Bell, X, Info, AlertTriangle, AlertCircle } from "lucide-react";

export default function GlobalAnnouncement() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    fetchAnnouncements();
    // Refresh announcements every 5 minutes
    const interval = setInterval(fetchAnnouncements, 1000 * 60 * 5);
    return () => clearInterval(interval);
  }, []);

  const fetchAnnouncements = async () => {
    const data = await getActiveBroadcasts();
    setAnnouncements(data);
  };

  const activeAnnouncements = announcements.filter(a => !dismissed.includes(a.id));

  if (activeAnnouncements.length === 0) return null;

  const current = activeAnnouncements[0];

  const colors = {
    info: { bg: "#3b82f6", text: "#fff", icon: <Info size={16} /> },
    warning: { bg: "#f59e0b", text: "#fff", icon: <AlertTriangle size={16} /> },
    critical: { bg: "#ef4444", text: "#fff", icon: <AlertCircle size={16} /> },
  };

  const theme = colors[current.type as keyof typeof colors] || colors.info;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: theme.bg,
      color: theme.text,
      padding: "0.5rem 1rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "1rem",
      fontSize: "0.85rem",
      fontWeight: "bold",
      boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
      animation: "slideDown 0.3s ease-out"
    }}>
      <style jsx>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {theme.icon}
        <span>{current.message}</span>
      </div>
      <button 
        onClick={() => setDismissed([...dismissed, current.id])}
        style={{ background: "rgba(0,0,0,0.1)", border: "none", color: "inherit", cursor: "pointer", borderRadius: "4px", padding: "2px" }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
