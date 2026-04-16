"use client";
import { useEffect, useRef, useState } from "react";

interface BarcodeScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const scannedRef = useRef(false);

  useEffect(() => {
    let scanner: any;

    const initScanner = async () => {
      try {
        const { Html5QrcodeScanner, Html5QrcodeScanType } = await import("html5-qrcode");
        
        if (!containerRef.current) return;

        scanner = new Html5QrcodeScanner(
          "wnp-qr-reader",
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [
              Html5QrcodeScanType.SCAN_TYPE_CAMERA,
              Html5QrcodeScanType.SCAN_TYPE_FILE,
            ],
            aspectRatio: 1.0,
            showZoomSliderIfSupported: true,
          },
          /* verbose= */ false
        );

        const onSuccess = (decodedText: string) => {
          if (scannedRef.current) return;
          scannedRef.current = true;
          onScan(decodedText.trim().toUpperCase());
          onClose();
        };

        const onScanFailure = () => {
          // silent - normal during scanning
        };

        scanner.render(onSuccess, onScanFailure);
        scannerRef.current = scanner;
        setIsLoading(false);
      } catch (err) {
        console.error(err);
        setError("Gagal memuat kamera. Pastikan browser mengizinkan akses kamera.");
        setIsLoading(false);
      }
    };

    initScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [onScan, onClose]);

  return (
    <div className="wnp-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="wnp-modal fade-in"
        style={{ maxWidth: "520px" }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: "bold", color: "var(--color-brand-text)" }}>
              📷 Scan Barcode
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--color-brand-muted)", marginTop: "0.25rem" }}>
              Arahkan kamera ke barcode label atau upload gambar
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid var(--color-brand-border)",
              color: "var(--color-brand-muted)",
              padding: "0.4rem 0.8rem",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "1.1rem",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Scanner Container */}
        {isLoading && (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-brand-muted)" }}>
            Memuat kamera...
          </div>
        )}

        {error && (
          <div style={{
            padding: "1rem",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid var(--color-brand-red)",
            borderRadius: "8px",
            color: "var(--color-brand-red)",
            marginBottom: "1rem",
            fontSize: "0.9rem",
          }}>
            {error}
          </div>
        )}

        <div ref={containerRef}>
          <div id="wnp-qr-reader" style={{ width: "100%", borderRadius: "8px", overflow: "hidden" }} />
        </div>

        <div style={{
          marginTop: "1rem",
          padding: "0.75rem 1rem",
          background: "rgba(124,58,237,0.08)",
          borderRadius: "8px",
          fontSize: "0.8rem",
          color: "var(--color-brand-muted)",
          display: "flex",
          gap: "0.5rem",
          alignItems: "flex-start",
        }}>
          <span style={{ flexShrink: 0 }}>💡</span>
          <span>
            Gunakan <strong style={{ color: "var(--color-brand-accent-light)" }}>kamera depan/belakang</strong> untuk scan.
            Barcode scanner fisik (USB/Bluetooth) otomatis terbaca via input field di halaman utama.
          </span>
        </div>
      </div>
    </div>
  );
}
