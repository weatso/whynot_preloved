export interface ReceiptData {
  items: { id: string; price: number }[];
  totalAmount: number;
  discountApplied: number;
  paymentMethod: "CASH" | "QRIS";
  cashierName: string;
}

export function buildReceiptMessage(data: ReceiptData): string {
  const itemLines = data.items
    .map((i) => `  ${i.id.padEnd(16)} Rp ${i.price.toLocaleString("id-ID")}`)
    .join("\n");

  const now = new Date().toLocaleString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return [
    `🏷️ *Struk Belanja Vynalee Preloved*`,
    `─────────────────`,
    itemLines,
    `─────────────────`,
    data.discountApplied > 0
      ? `Diskon: -Rp ${data.discountApplied.toLocaleString("id-ID")}`
      : null,
    `*Total: Rp ${data.totalAmount.toLocaleString("id-ID")}*`,
    `Metode: ${data.paymentMethod}`,
    `Kasir: ${data.cashierName}`,
    `Waktu: ${now}`,
    `─────────────────`,
    `Terima kasih! Sampai di event Vynalee berikutnya 🛍️`,
  ].filter(Boolean).join("\n");
}

export async function sendWaReceipt(
  phoneNumber: string,
  data: ReceiptData
): Promise<{ success: boolean; mock?: boolean }> {
  const message = buildReceiptMessage(data);

  // Check if real API token is available
  const token = process.env.NEXT_PUBLIC_WA_API_TOKEN || "mock";
  if (token === "mock" || !token) {
    // MOCK MODE — log to console, always succeed
    console.log(`[WA MOCK] To: ${phoneNumber}`);
    console.log(message);
    await new Promise((r) => setTimeout(r, 500)); // simulate delay
    return { success: true, mock: true };
  }

  // PRODUCTION — call Fonnte API
  try {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ target: phoneNumber, message }),
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}
