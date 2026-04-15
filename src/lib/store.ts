import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "./supabase";

export interface EventSession {
  eventId: string | null;
  eventName: string;
  saleType: "event" | "daily";
}

export interface CartItem {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice: number;
  itemDiscountPct: number;
  vendorId: string | null;
}

export interface CachedItem {
  id: string;
  name: string;
  category: string;
  size: string | null;
  color: string | null;
  price: number;
  discount_percentage: number;
  vendor_id: string | null;
  status: string;
}

export interface PendingTransaction {
  localId: string;
  items: CartItem[];
  subtotal: number;
  discountCode: string | null;
  discountPct: number;
  discountBearer: string | null;
  total: number;
  paymentMethod: "CASH" | "QRIS";
  customerPhone: string | null;
  cashierName: string;
  cashierId: string;
  eventId: string | null;
  saleType: "event" | "daily";
  timestamp: number;
  retryCount: number;
}

interface CartStore {
  items: CartItem[];
  eventSession: EventSession | null;
  appliedDiscount: { code: string; pct: number; bearer: string } | null;
  pendingTransactions: PendingTransaction[];
  cachedItems: CachedItem[];
  cacheLastSync: number;
  isRetrying: boolean;

  setEventSession: (s: EventSession) => void;
  clearEventSession: () => void;
  addItem: (item: CartItem) => void;
  voidCartItem: (id: string, cashierName: string, cashierId: string, reason: string) => Promise<void>;
  clearCart: (cashierName: string, cashierId: string) => Promise<void>;
  applyDiscountCode: (code: string) => Promise<{ success: boolean; error?: string }>;
  clearDiscount: () => void;
  submitTransaction: (paymentMethod: "CASH" | "QRIS", cashierName: string, cashierId: string, customerPhone?: string | null) => Promise<{ success: boolean; offline?: boolean }>;
  retryPending: () => Promise<void>;
  syncItemCache: () => Promise<void>;
}

async function pushTxnToSupabase(p: PendingTransaction): Promise<boolean> {
  try {
    const codePct = p.discountPct / 100;
    const { data: txn, error: txnErr } = await supabase
      .from("transactions")
      .insert({
        total_amount: p.total,
        discount_applied: p.subtotal - p.total,
        discount_code: p.discountCode,
        discount_bearer: p.discountBearer,
        payment_method: p.paymentMethod,
        cashier_name: p.cashierName,
        cashier_id: p.cashierId,
        customer_phone: p.customerPhone || null,
        event_id: p.eventId,
        sale_type: p.saleType,
      })
      .select()
      .single();

    if (txnErr || !txn) return false;

    const pivotRows = p.items.map((item) => {
      const priceAtSale = codePct > 0 ? Math.round(item.price * (1 - codePct)) : item.price;
      return {
        transaction_id: txn.id,
        item_id: item.id,
        price_at_sale: priceAtSale,
        discount_applied: item.originalPrice - priceAtSale,
        discount_code_used: p.discountCode,
        discount_bearer: p.discountBearer,
      };
    });

    const { error: pivotErr } = await supabase.from("transaction_items").insert(pivotRows);
    if (pivotErr) return false;

    await supabase.from("items").update({ status: "sold" }).in("id", p.items.map((i) => i.id));
    return true;
  } catch {
    return false;
  }
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      eventSession: null,
      appliedDiscount: null,
      pendingTransactions: [],
      cachedItems: [],
      cacheLastSync: 0,
      isRetrying: false,

      setEventSession: (s) => set({ eventSession: s }),
      clearEventSession: () => set({ eventSession: null }),

      addItem: (item) => set((state) => {
        if (state.items.find((i) => i.id === item.id)) return state;
        return { items: [...state.items, item] };
      }),

      voidCartItem: async (id, cashierName, cashierId, reason) => {
        // Hapus langsung dari UI tanpa blokir
        set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
        // Log diam-diam ke Supabase
        supabase.from("items").update({ status: "available" }).eq("id", id).then();
        supabase.from("audit_logs").insert({
          action: "VOID_ITEM",
          item_id: id,
          cashier_name: cashierName,
          cashier_id: cashierId,
          reason,
        }).then();
      },

      clearCart: async (cashierName, cashierId) => {
        const { items } = get();
        if (!items.length) return;
        const ids = items.map((i) => i.id);
        set({ items: [], appliedDiscount: null });
        
        supabase.from("items").update({ status: "available" }).in("id", ids).then();
        supabase.from("audit_logs").insert({
          action: "CART_CLEAR",
          cashier_name: cashierName,
          cashier_id: cashierId,
          reason: "Cart cleared by cashier",
          old_value: ids.join(", "),
        }).then();
      },

      applyDiscountCode: async (code) => {
        const { data, error } = await supabase
          .from("discount_codes")
          .select("code, discount_percentage, bearer, is_active, expires_at")
          .eq("code", code.toUpperCase().trim())
          .single();

        if (error || !data) return { success: false, error: "Kode tidak ditemukan" };
        if (!data.is_active) return { success: false, error: "Kode tidak aktif" };
        if (data.expires_at && new Date(data.expires_at) < new Date()) return { success: false, error: "Kode kadaluarsa" };

        set({ appliedDiscount: { code: data.code, pct: data.discount_percentage, bearer: data.bearer } });
        return { success: true };
      },

      clearDiscount: () => set({ appliedDiscount: null }),

      submitTransaction: async (paymentMethod, cashierName, cashierId, customerPhone) => {
        const { items, appliedDiscount, eventSession } = get();
        if (!items.length) return { success: false };

        const subtotal = items.reduce((s, i) => s + i.price, 0);
        const discountAmount = appliedDiscount ? Math.round(subtotal * (appliedDiscount.pct / 100)) : 0;
        const total = subtotal - discountAmount;

        const pending: PendingTransaction = {
          localId: `local_${Date.now()}`,
          items: [...items],
          subtotal,
          discountCode: appliedDiscount?.code ?? null,
          discountPct: appliedDiscount?.pct ?? 0,
          discountBearer: appliedDiscount?.bearer ?? null,
          total,
          paymentMethod,
          customerPhone: customerPhone ?? null,
          cashierName,
          cashierId,
          eventId: eventSession?.eventId ?? null,
          saleType: eventSession?.saleType ?? "daily",
          timestamp: Date.now(),
          retryCount: 0,
        };

        const success = await pushTxnToSupabase(pending);
        if (success) {
          set({ items: [], appliedDiscount: null });
          return { success: true };
        }

        // Jika offline, ubah status item di cache lokal agar tidak double scan, lalu antre
        set((state) => ({
          cachedItems: state.cachedItems.map(item => items.find(i => i.id === item.id) ? { ...item, status: "sold" } : item),
          pendingTransactions: [...state.pendingTransactions, pending],
          items: [],
          appliedDiscount: null,
        }));
        return { success: false, offline: true };
      },

      retryPending: async () => {
        const { pendingTransactions, isRetrying } = get();
        if (isRetrying || !pendingTransactions.length) return;
        set({ isRetrying: true });
        const remaining: PendingTransaction[] = [];
        for (const p of pendingTransactions) {
          const ok = await pushTxnToSupabase(p);
          if (!ok) remaining.push({ ...p, retryCount: p.retryCount + 1 });
        }
        set({ pendingTransactions: remaining, isRetrying: false });
      },

      syncItemCache: async () => {
        try {
          const { data } = await supabase.from("items").select("*").eq("status", "available").limit(5000);
          if (data) set({ cachedItems: data as CachedItem[], cacheLastSync: Date.now() });
        } catch { /* abaikan jika offline */ }
      },
    }),
    {
      name: "wnp-cart-v3",
      partialize: (s) => ({
        items: s.items,
        eventSession: s.eventSession,
        pendingTransactions: s.pendingTransactions,
        cachedItems: s.cachedItems,
        cacheLastSync: s.cacheLastSync,
      }),
    }
  )
);