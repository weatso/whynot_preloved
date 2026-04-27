"use server";

import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function executePayout(
  token: string, 
  vendorId: string, 
  payoutData: { total_sales: number, total_commission_deducted: number, net_payout: number, total_items: number },
  transactionItemsData: { transaction_id: string, item_id: string }[]
) {
  try {
    // 1. Verifikasi JWT
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!) as any;
    if (decoded.app_role !== 'owner' && decoded.app_role !== 'admin') {
      return { success: false, error: 'Unauthorized: Hanya Owner/Admin yang dapat melakukan payout.' };
    }
    
    const tenantId = decoded.tenant_id;
    const userId = decoded.sub;

    // 2. Insert ke tabel vendor_payouts
    const { data: payout, error: pErr } = await supabaseAdmin
      .from("vendor_payouts")
      .insert({
        tenant_id: tenantId,
        vendor_id: vendorId,
        total_sales: payoutData.total_sales,
        total_commission_deducted: payoutData.total_commission_deducted,
        net_payout: payoutData.net_payout,
        total_items: payoutData.total_items,
        paid_by: userId
      })
      .select()
      .single();

    if (pErr || !payout) throw pErr;

    // 3. Batch Update transaction_items
    // Menghindari konflik dengan item yang divoid/discan ulang di masa lalu dengan spesifik ke transaction_id dan item_id
    const updates = transactionItemsData.map(ti => 
      supabaseAdmin.from("transaction_items")
        .update({ is_settled: true, payout_id: payout.id })
        .eq("transaction_id", ti.transaction_id)
        .eq("item_id", ti.item_id)
        .eq("tenant_id", tenantId) // Extra security
    );
    
    // Mengeksekusi semua update secara paralel menggunakan Supabase Admin
    await Promise.all(updates);

    return { success: true, payoutId: payout.id };
  } catch (err: any) {
    console.error("Payout Execution Error:", err);
    return { success: false, error: err.message || "Terjadi kesalahan internal server" };
  }
}
