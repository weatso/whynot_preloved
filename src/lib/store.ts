import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "./supabase";
import { useAuthStore } from "./authStore";

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
  vendorCommissionRate: number;
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
  vendor_commission_rate: number;
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
    const token = useAuthStore.getState().token;
    if (!token) throw new Error("No token found");
    const jwtPayload = JSON.parse(atob(token.split('.')[1]));
    const tenantId = jwtPayload.tenant_id;

    if (!tenantId) throw new Error("No tenant_id in token");

    // Persiapkan data item untuk RPC
    const codePct = p.discountPct / 100;
    const itemPayload = p.items.map(item => {
      const priceAtSale = codePct > 0 ? Math.round(item.price * (1 - codePct)) : item.price;
      return {
        item_id: item.id,
        price_at_sale: priceAtSale,
        discount_applied: item.originalPrice - priceAtSale,
        vendor_commission_rate: item.vendorCommissionRate
      };
    });

    // Panggil RPC Atomic Checkout
    const { data: txnId, error } = await supabase.rpc("process_checkout_v2", {
      p_tenant_id: tenantId,
      p_cashier_id: p.cashierId,
      p_cashier_name: p.cashierName,
      p_total_amount: p.total,
      p_discount_applied: p.subtotal - p.total,
      p_payment_method: p.paymentMethod,
      p_sale_type: p.saleType,
      p_event_id: p.eventId,
      p_items: itemPayload
    });

    if (error) {
      console.error("RPC_CHECKOUT_ERROR:", error.message);
      return { success: false };
    }

    // Update Customer Info (Opsional, dilakukan setelah transaksi sukses)
    if (p.customerPhone) {
      supabase.from("customers").upsert(
        { phone_number: p.customerPhone, tenant_id: tenantId, name: p.customerPhone, last_visit: new Date().toISOString() },
        { onConflict: "tenant_id,phone_number" }
      ).then();
    }

    return { success: true, txnId };
  } catch (err) {
    console.error("ATOMIC_CHECKOUT_CATCH:", err);
    return { success: false };
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
        return { 
          items: [...state.items, item],
          // Sync Cache: Ubah status di lokal agar tidak bisa di-scan 2x
          cachedItems: state.cachedItems.map(i => i.id === item.id ? { ...i, status: "in_cart" } : i)
        };
      }),

      voidCartItem: async (id, cashierName, cashierId, reason) => {
        set((state) => ({ 
          items: state.items.filter((i) => i.id !== id),
          // Sync Cache: Kembalikan ke available secara instan di lokal
          cachedItems: state.cachedItems.map(i => i.id === id ? { ...i, status: "available" } : i)
        }));
        
        supabase.from("items").update({ status: "available" }).eq("id", id).then();
        supabase.from("audit_logs").insert({
          action: "VOID_CART_ITEM",
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
        
        set((state) => ({ 
          items: [], 
          appliedDiscount: null,
          // Sync Cache: Kembalikan semua barang ke available di lokal
          cachedItems: state.cachedItems.map(i => ids.includes(i.id) ? { ...i, status: "available" } : i)
        }));
        
        supabase.from("items").update({ status: "available" }).in("id", ids).then();
        supabase.from("audit_logs").insert({
          action: "CART_CLEAR",
          cashier_name: cashierName,
          cashier_id: cashierId,
          reason: "Kasir mengosongkan seluruh keranjang",
          item_id: ids.join(", "),
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

        const res = await pushTxnToSupabase(pending);
        if (res.success) {
          set({ items: [], appliedDiscount: null });
          return { success: true, txnId: res.txnId };
        }

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
          const { data, error } = await supabase
            .from("items")
            .select("*, vendors(commission_rate_percentage)")
            .eq("status", "available")
            .limit(5000);

          if (error) {
            console.error("Sync Cache Error:", error);
          }

          if (data) {
            const mapped = data.map((d: any) => ({
              ...d,
              vendor_commission_rate: d.vendors?.commission_rate_percentage || 0
            }));
            set({ cachedItems: mapped as CachedItem[], cacheLastSync: Date.now() });
          }
        } catch (e) {
          console.error("Sync Cache Catch:", e);
        }
      },
    }),
    {
      name: "wnp-cart-v4",
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