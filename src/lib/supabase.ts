import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("[WNP] Missing Supabase env vars");
  _supabase = createClient(url, key, { realtime: { timeout: 10000 } });
  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type ItemStatus = "available" | "in_cart" | "sold" | "void";
export type UserRole = "owner" | "admin" | "kasir";
export type SaleType = "event" | "daily";

export interface AppUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
}

export interface Vendor {
  id: string;
  code: string;
  name: string;
  commission_rate_percentage: number;
  bank_account: string | null;
  phone_number: string | null;
  is_active: boolean;
  item_count: number;
}

export interface EventRecord {
  id: string;
  name: string;
  location: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  is_closed: boolean;
  created_at: string;
}

export interface Item {
  id: string;
  batch_id: string | null;
  vendor_id: string | null;
  name: string;
  category: string;
  size: string | null;
  color: string | null;
  condition: string | null;
  description: string | null;
  price: number;
  cost_price: number;
  discount_percentage: number;
  status: ItemStatus;
  event_id: string | null;
  updated_at: string;
  created_at: string;
}

export interface DiscountCode {
  code: string;
  description: string | null;
  discount_percentage: number;
  bearer: "vendor" | "vynalee";
  usage_count: number;
  total_discount_given: number;
  is_active: boolean;
  expires_at: string | null;
}

export interface Transaction {
  id: string;
  total_amount: number;
  discount_applied: number;
  discount_code: string | null;
  discount_bearer: string | null;
  payment_method: "CASH" | "QRIS";
  customer_phone: string | null;
  cashier_name: string | null;
  cashier_id: string | null;
  event_id: string | null;
  sale_type: SaleType;
  status: "completed" | "void";
  void_reason: string | null;
  void_by: string | null;
  void_at: string | null;
  created_at: string;
}