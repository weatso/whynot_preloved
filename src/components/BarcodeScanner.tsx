"use client";
import { useEffect, useRef, useState } from "react";

interface BarcodeScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const scannedRef = useRef(false);

  useEffect(() => {
    let scanner: any;

    const initScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        // Selalu gunakan kamera belakang langsung — tidak ada mode selection
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
          setError("Tidak ada kamera ditemukan di perangkat ini.");
          setIsLoading(false);
          return;
        }

        // Pilih kamera belakang jika ada, kalau tidak pilih yang pertama
        const backCamera = cameras.find(c =>
          c.label.toLowerCase().includes("back") ||
          c.label.toLowerCase().includes("rear") ||
          c.label.toLowerCase().includes("environment")
        ) || cameras[cameras.length - 1];

        scanner = new Html5Qrcode("wnp-qr-reader");

        await scanner.start(
          backCamera.id,
          { fps: 15, qrbox: { width: 280, height: 160 }, aspectRatio: 1.7 },
          (decodedText: string) => {
            if (scannedRef.current) return;
            scannedRef.current = true;
            onScan(decodedText.trim().toUpperCase());
            onClose();
          },
          () => { /* silent failure during scan */ }
        );

        scannerRef.current = scanner;
        setIsLoading(false);
      } catch (err: any) {
        console.error(err);
        if (err?.name === "NotAllowedError" || String(err).includes("Permission")) {
          setError("Akses kamera ditolak. Izinkan kamera di pengaturan browser lalu coba lagi.");
        } else {
          setError("Gagal membuka kamera. Pastikan tidak ada aplikasi lain yang menggunakan kamera.");
        }
        setIsLoading(false);
      }
    };

    initScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).then(() => {
          scannerRef.current?.clear().catch(() => {});
        });
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", zIndex: 9999, padding: "1rem",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: "480px",
        background: "var(--color-brand-card)",
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid var(--color-brand-border)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1rem 1.25rem",
          borderBottom: "1px solid var(--color-brand-border)",
          background: "var(--color-brand-surface)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.3rem" }}>📷</span>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: "bold", color: "var(--color-brand-text)", margin: 0 }}>Scan Barcode</h2>
              <p style={{ fontSize: "0.75rem", color: "var(--color-brand-muted)", margin: 0 }}>Arahkan ke label barcode barang</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid var(--color-brand-red)",
              color: "var(--color-brand-red)", padding: "0.4rem 0.8rem",
              borderRadius: "6px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "bold",
            }}
          >
            ✕ Tutup
          </button>
        </div>

        {/* Camera View */}
        <div style={{ position: "relative", background: "#000", minHeight: "220px" }}>
          {isLoading && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: "0.75rem",
              color: "white", fontSize: "0.9rem",
            }}>
              <div style={{ fontSize: "2rem" }}>📷</div>
              <span>Membuka kamera...</span>
            </div>
          )}
          <div id="wnp-qr-reader" style={{ width: "100%" }} />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: "1.25rem",
            background: "rgba(239,68,68,0.08)",
            borderTop: "1px solid var(--color-brand-red)",
            color: "var(--color-brand-red)", fontSize: "0.85rem",
            display: "flex", flexDirection: "column", gap: "0.75rem",
          }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0 }}>⚠️</span>
              <span>{error}</span>
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--color-brand-muted)", lineHeight: 1.5 }}>
              <strong>Cara mengaktifkan kamera:</strong><br />
              • Chrome: Klik ikon 🔒 di address bar → Site settings → Camera → Allow<br />
              • Safari: Settings → Safari → Camera → Allow<br />
              • Firefox: Klik ikon kamera di address bar → Allow
            </div>
            <button
              onClick={() => { setError(null); setIsLoading(true); window.location.reload(); }}
              style={{
                background: "var(--color-brand-accent)", color: "white",
                border: "none", padding: "0.6rem 1rem", borderRadius: "8px",
                cursor: "pointer", fontWeight: "bold", fontSize: "0.85rem",
                alignSelf: "flex-start",
              }}
            >
              🔄 Coba Lagi
            </button>
          </div>
        )}

        {/* Footer hint */}
        {!error && !isLoading && (
          <div style={{
            padding: "0.75rem 1.25rem", background: "var(--color-brand-surface)",
            fontSize: "0.78rem", color: "var(--color-brand-muted)",
            display: "flex", gap: "0.5rem", alignItems: "center",
            borderTop: "1px solid var(--color-brand-border)",
          }}>
            <span>💡</span>
            <span>Posisikan barcode di tengah area yang terdeteksi. Scanner fisik tetap bisa dipakai via input field.</span>
          </div>
        )}
      </div>
    </div>
  );
}
