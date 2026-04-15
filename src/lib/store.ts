import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "./supabase";
import { verifyVoidKey } from "./voidKey";
import type { SaleType } from "./supabase";

export interface EventSession {
  eventId: string | null;
  eventName: string;
  saleType: SaleType;
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

export interface AppliedDiscount {
  code: string;
  pct: number;
  bearer: "vendor" | "vynalee";
  description: string | null;
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
  saleType: SaleType;
  timestamp: number;
  retryCount: number;
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

interface CartStore {
  items: CartItem[];
  eventSession: EventSession | null;
  appliedDiscount: AppliedDiscount | null;
  pendingTransactions: PendingTransaction[];
  cachedItems: CachedItem[];
  cacheLastSync: number;
  isRetrying: boolean;

  setEventSession: (s: EventSession) => void;
  clearEventSession: () => void;
  addItem: (item: CartItem) => void;
  voidCartItem: (id: string, cashierName: string, cashierId: string, key: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  clearCart: (cashierName: string, cashierId: string) => Promise<void>;
  applyDiscountCode: (code: string) => Promise<{ success: boolean; error?: string }>;
  clearDiscount: () => void;
  getCheckoutSummary: () => { subtotal: number; discountAmount: number; total: number };
  submitTransaction: (paymentMethod: "CASH" | "QRIS", cashierName: string, cashierId: string, customerPhone?: string | null) => Promise<{ success: boolean; offline?: boolean }>;
  retryPending: () => Promise<void>;
  syncItemCache: () => Promise<void>;
  searchCache: (query: string) => CachedItem[];
  resetAll: () => void;
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
      const priceBeforeCode = item.price;
      const priceAtSale = codePct > 0 ? Math.round(item.price * (1 - codePct)) : item.price;
      return {
        transaction_id: txn.id,
        item_id: item.id,
        price_before_code_discount: priceBeforeCode,
        price_at_sale: priceAtSale,
        discount_applied: item.originalPrice - item.price,
        discount_code_used: p.discountCode,
        discount_bearer: p.discountBearer,
      };
    });

    const { error: pivotErr } = await supabase.from("transaction_items").insert(pivotRows);
    if (pivotErr) return false;

    await supabase.from("items").update({ status: "sold" }).in("id", p.items.map((i) => i.id));

    if (p.discountCode) {
      await supabase.from("discount_codes")
        .update({ usage_count: 1, total_discount_given: p.subtotal - p.total })
        .eq("code", p.discountCode);
    }

    if (p.customerPhone) {
      await supabase.from("customers").upsert(
        { phone_number: p.customerPhone, last_visit: new Date().toISOString(), total_visits: 1, total_spent: p.total },
        { onConflict: "phone_number" }
      );
    }

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

      addItem: (item) =>
        set((state) => {
          if (state.items.find((i) => i.id === item.id)) return state;
          return { items: [...state.items, item] };
        }),

      voidCartItem: async (id, cashierName, cashierId, key, reason) => {
        const valid = await verifyVoidKey(key);
        if (!valid) return { success: false, error: "Kode void salah" };

        await supabase.from("items").update({ status: "available" }).eq("id", id);
        await supabase.from("audit_logs").insert({
          action: "VOID_ITEM",
          item_id: id,
          cashier_name: cashierName,
          cashier_id: cashierId,
          reason,
        });

        set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
        return { success: true };
      },

      clearCart: async (cashierName, cashierId) => {
        const { items } = get();
        if (!items.length) return;
        const ids = items.map((i) => i.id);
        await supabase.from("items").update({ status: "available" }).in("id", ids);
        await supabase.from("audit_logs").insert({
          action: "CART_CLEAR",
          cashier_name: cashierName,
          cashier_id: cashierId,
          reason: "Cart cleared by cashier",
          old_value: ids.join(", "),
        });
        set({ items: [], appliedDiscount: null });
      },

      applyDiscountCode: async (code) => {
        const { data, error } = await supabase
          .from("discount_codes")
          .select("code, description, discount_percentage, bearer, is_active, expires_at")
          .eq("code", code.toUpperCase().trim())
          .single();

        if (error || !data) return { success: false, error: "Kode diskon tidak ditemukan" };
        if (!data.is_active) return { success: false, error: "Kode diskon tidak aktif" };
        if (data.expires_at && new Date(data.expires_at) < new Date())
          return { success: false, error: "Kode diskon sudah kadaluarsa" };

        set({
          appliedDiscount: {
            code: data.code,
            pct: data.discount_percentage,
            bearer: data.bearer as "vendor" | "vynalee",
            description: data.description,
          },
        });
        return { success: true };
      },

      clearDiscount: () => set({ appliedDiscount: null }),

      getCheckoutSummary: () => {
        const { items, appliedDiscount } = get();
        const subtotal = items.reduce((s, i) => s + i.price, 0);
        const discountAmount = appliedDiscount
          ? Math.round(subtotal * (appliedDiscount.pct / 100))
          : 0;
        return { subtotal, discountAmount, total: subtotal - discountAmount };
      },

      submitTransaction: async (paymentMethod, cashierName, cashierId, customerPhone) => {
        const { items, appliedDiscount, eventSession } = get();
        if (!items.length) return { success: false };

        const { subtotal, discountAmount, total } = get().getCheckoutSummary();

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

        // Queue offline
        await supabase.from("items").update({ status: "sold" }).in("id", items.map((i) => i.id)).then(() => {});
        set((state) => ({
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
          const { data } = await supabase
            .from("items")
            .select("id, name, category, size, color, price, discount_percentage, vendor_id, status")
            .eq("status", "available")
            .order("name")
            .limit(2000);
          if (data) set({ cachedItems: data as CachedItem[], cacheLastSync: Date.now() });
        } catch { /* offline */ }
      },

      searchCache: (query) => {
        const { cachedItems } = get();
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        return cachedItems
          .filter((i) =>
            i.status === "available" && (
              i.id.toLowerCase().includes(q) ||
              i.name.toLowerCase().includes(q) ||
              (i.category ?? "").toLowerCase().includes(q) ||
              (i.color ?? "").toLowerCase().includes(q) ||
              (i.size ?? "").toLowerCase().includes(q)
            )
          )
          .slice(0, 20);
      },

      resetAll: () => set({ items: [], eventSession: null, appliedDiscount: null }),
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