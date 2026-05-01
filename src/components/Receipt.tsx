"use client";
import React from "react";

interface ReceiptProps {
  id: string;
  date: string;
  cashier: string;
  items: any[];
  subtotal: number;
  discount: { code: string; amount: number } | null;
  total: number;
  paymentMethod: string;
  branding?: { name: string; receiptFooter: string | null };
}

export default function Receipt({
  id,
  date,
  cashier,
  items,
  subtotal,
  discount,
  total,
  paymentMethod,
  branding,
}: ReceiptProps) {
  return (
    <div className="print-only" style={{
      width: "100%",
      maxWidth: "300px",
      margin: "0 auto",
      padding: "20px 10px",
      fontFamily: "'Courier New', Courier, monospace",
      color: "#000",
      backgroundColor: "#fff",
      fontSize: "12px",
      lineHeight: "1.2"
    }}>
      <style jsx global>{`
        @media screen {
          .print-only { display: none !important; }
        }
        @media print {
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .print-only {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: block !important;
          }
          @page {
            margin: 0;
            size: 80mm auto;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "15px" }}>
        <h2 style={{ margin: "0 0 5px 0", fontSize: "16px", fontWeight: "bold" }}>{branding?.name || "PRELOVED SYSTEM"}</h2>
        <p style={{ margin: 0 }}>{branding?.name ? "Official Store Receipt" : "Premium Thrift & Vintage"}</p>
        <p style={{ margin: "5px 0" }}>--------------------------------</p>
      </div>

      {/* Info */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>TGL: {new Date(date).toLocaleString("id-ID")}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>ID: {id.slice(0, 8).toUpperCase()}</span>
          <span>KS: {cashier}</span>
        </div>
        <p style={{ margin: "5px 0" }}>--------------------------------</p>
      </div>

      {/* Items */}
      <div style={{ marginBottom: "10px" }}>
        {items.map((item, idx) => (
          <div key={idx} style={{ marginBottom: "5px" }}>
            <div style={{ fontWeight: "bold" }}>{item.name}</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>1 x {item.price.toLocaleString("id-ID")}</span>
              <span>{item.price.toLocaleString("id-ID")}</span>
            </div>
            {item.itemDiscountPct > 0 && (
              <div style={{ fontSize: "10px", color: "#444" }}>
                (Disc {item.itemDiscountPct}%)
              </div>
            )}
          </div>
        ))}
        <p style={{ margin: "5px 0" }}>--------------------------------</p>
      </div>

      {/* Totals */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Subtotal</span>
          <span>{subtotal.toLocaleString("id-ID")}</span>
        </div>
        {discount && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Diskon ({discount.code})</span>
            <span>-{discount.amount.toLocaleString("id-ID")}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "14px", marginTop: "5px" }}>
          <span>TOTAL</span>
          <span>{total.toLocaleString("id-ID")}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "5px" }}>
          <span>Metode Bayar</span>
          <span>{paymentMethod}</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <p style={{ margin: "5px 0" }}>--------------------------------</p>
        <p style={{ margin: "5px 0", fontSize: "10px" }}>
          {branding?.receiptFooter || "Barang preloved yang sudah dibeli tidak dapat ditukar atau dikembalikan."}
        </p>
        <p style={{ margin: "5px 0", fontWeight: "bold" }}>Terima kasih atas kunjungan Anda!</p>
        <p style={{ margin: "10px 0 0 0", fontSize: "8px", color: "#666" }}>System powered by WEATSO</p>
      </div>
    </div>
  );
}
