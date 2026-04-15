import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { phoneNumber, receiptData } = await req.json();
  const token = process.env.WA_API_TOKEN || "mock";

  if (token === "mock" || !token) {
    console.log(`[WA MOCK] Sending receipt to ${phoneNumber}`);
    return NextResponse.json({ success: true, mock: true });
  }

  try {
    const message = `🏷️ *Struk Vynalee*\nTotal: Rp ${receiptData.totalAmount.toLocaleString("id-ID")}\nMetode: ${receiptData.paymentMethod}`;
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ target: phoneNumber, message }),
    });
    return NextResponse.json({ success: res.ok });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
