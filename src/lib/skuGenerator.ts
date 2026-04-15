import { supabase } from "./supabase";

export interface GeneratedSku {
  id: string;
  batch_id: string;
  vendor_id: string | null;
  price: number;
  cost_price: number;
  status: "available";
}

export function formatPriceLabel(price: number): string {
  if (price >= 1_000_000) return `${Math.round(price / 1_000_000)}M`;
  if (price >= 1_000) return `${Math.round(price / 1_000)}K`;
  return `${price}`;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatShortTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch { return "--:--"; }
}

export async function generateSkuBatch(
  count: number,
  price: number,
  prefix: string = "PRL",
  vendorId: string | null = null,
  costPrice: number = 0
): Promise<{ success: boolean; items: GeneratedSku[]; error?: string }> {
  const priceLabel = formatPriceLabel(price);
  const batchId = `${prefix}-${priceLabel}-${Date.now()}`;
  const paddingLength = Math.max(3, String(count).length);
  const items: GeneratedSku[] = [];

  for (let i = 1; i <= count; i++) {
    const seq = String(i).padStart(paddingLength, "0");
    items.push({
      id: `${prefix}-${priceLabel}-${seq}`,
      batch_id: batchId,
      vendor_id: vendorId,
      price,
      cost_price: costPrice,
      status: "available",
    });
  }

  try {
    const { error } = await supabase.from("items").insert(items);
    if (error) return { success: false, items, error: error.message };
    return { success: true, items };
  } catch (err) {
    return { success: false, items, error: err instanceof Error ? err.message : "Network error" };
  }
}
