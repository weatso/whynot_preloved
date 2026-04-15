import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "./supabase";

export interface CartItem {
  id: string;
  price: number;
  originalPrice: number;
  discountPercentage: number;
  vendorId: string | null;
}

export interface PendingTransaction {
  id: string;
  items: CartItem[];
  totalAmount: number;
  discountApplied: number;
  paymentMethod: "CASH" | "QRIS";
  customerPhone: string | null;
  cashierName: string;
  cashierId: string;
  timestamp: number;
  retryCount: number;
}

interface CartStore {
  items: CartItem[];
  pendingTransactions: PendingTransaction[];
  isRetrying: boolean;

  addItem: (item: CartItem) => void;
  removeItem: (id: string, cashierName: string, cashierId: string) => Promise<void>;
  clearCart: (cashierName: string, cashierId: string, reason?: string) => Promise<void>;
  submitTransaction: (
    paymentMethod: "CASH" | "QRIS",
    cashierName: string,
    cashierId: string,
    customerPhone?: string
  ) => Promise<boolean>;
  retryPending: () => Promise<void>;
}

const pushToSupabase = async (
  items: CartItem[],
  totalAmount: number,
  discountApplied: number,
  paymentMethod: "CASH" | "QRIS",
  cashierName: string,
  cashierId: string,
  customerPhone?: string | null
): Promise<boolean> => {
  try {
    // Upsert customer if phone provided
    if (customerPhone) {
      await supabase.from("customers").upsert(
        { phone_number: customerPhone, last_visit: new Date().toISOString() },
        { onConflict: "phone_number" }
      );
      await supabase.rpc("increment_customer_stats", {
        p_phone: customerPhone,
        p_amount: totalAmount,
      }).maybeSingle();
    }

    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .insert({
        total_amount: totalAmount,
        discount_applied: discountApplied,
        payment_method: paymentMethod,
        cashier_name: cashierName,
        cashier_id: cashierId,
        customer_phone: customerPhone || null,
      })
      .select()
      .single();

    if (txnError || !txn) return false;

    const pivotRows = items.map((item) => ({
      transaction_id: txn.id,
      item_id: item.id,
      price_at_sale: item.price,
      discount_applied: item.discountPercentage,
    }));

    const { error: pivotError } = await supabase.from("transaction_items").insert(pivotRows);
    if (pivotError) return false;

    const { error: updateError } = await supabase
      .from("items")
      .update({ status: "sold" })
      .in("id", items.map((i) => i.id));

    if (updateError) return false;
    return true;
  } catch {
    return false;
  }
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      pendingTransactions: [],
      isRetrying: false,

      addItem: (item) =>
        set((state) => {
          if (state.items.find((i) => i.id === item.id)) return state;
          return { items: [...state.items, item] };
        }),

      removeItem: async (id, cashierName, cashierId) => {
        // Log void to audit_logs
        await supabase.from("audit_logs").insert({
          action: "VOID_ITEM",
          item_id: id,
          cashier_name: cashierName,
          cashier_id: cashierId,
          reason: "Removed from cart",
        });
        // Reset item back to available
        await supabase.from("items").update({ status: "available" }).eq("id", id);
        set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
      },

      clearCart: async (cashierName, cashierId, reason = "Cart cleared") => {
        const { items } = get();
        if (items.length === 0) return;
        const ids = items.map((i) => i.id);
        await supabase.from("audit_logs").insert({
          action: "CART_CLEAR",
          cashier_name: cashierName,
          cashier_id: cashierId,
          reason,
          old_value: ids.join(", "),
        });
        await supabase.from("items").update({ status: "available" }).in("id", ids);
        set({ items: [] });
      },

      submitTransaction: async (paymentMethod, cashierName, cashierId, customerPhone) => {
        const { items } = get();
        if (items.length === 0) return false;

        const discountApplied = items.reduce(
          (sum, i) => sum + (i.originalPrice - i.price),
          0
        );
        const totalAmount = items.reduce((sum, i) => sum + i.price, 0);

        const success = await pushToSupabase(
          items, totalAmount, discountApplied,
          paymentMethod, cashierName, cashierId, customerPhone
        );

        if (success) {
          set({ items: [] });
          return true;
        } else {
          // Queue for offline retry
          const pending: PendingTransaction = {
            id: `local_${Date.now()}`,
            items: [...items],
            totalAmount,
            discountApplied,
            paymentMethod,
            customerPhone: customerPhone || null,
            cashierName,
            cashierId,
            timestamp: Date.now(),
            retryCount: 0,
          };
          set((state) => ({
            pendingTransactions: [...state.pendingTransactions, pending],
            items: [],
          }));
          return false;
        }
      },

      retryPending: async () => {
        const { pendingTransactions, isRetrying } = get();
        if (isRetrying || pendingTransactions.length === 0) return;
        set({ isRetrying: true });
        const remaining: PendingTransaction[] = [];
        for (const p of pendingTransactions) {
          const ok = await pushToSupabase(
            p.items, p.totalAmount, p.discountApplied,
            p.paymentMethod, p.cashierName, p.cashierId, p.customerPhone
          );
          if (!ok) remaining.push({ ...p, retryCount: p.retryCount + 1 });
        }
        set({ pendingTransactions: remaining, isRetrying: false });
      },
    }),
    {
      name: "vynalee-cart-v2",
      partialize: (state) => ({
        items: state.items,
        pendingTransactions: state.pendingTransactions,
      }),
    }
  )
);
