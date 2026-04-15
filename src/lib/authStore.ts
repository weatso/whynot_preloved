import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "./supabase";
import type { UserRole } from "./supabase";

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
}

interface AuthStore {
  user: AuthUser | null;
  login: (username: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  canAccess: (page: string) => boolean;
}

const OWNER_PAGES = ["settlement", "audit", "generate", "events", "vendors", "discounts", "settings"];

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,

      login: async (username, pin) => {
        const { data, error } = await supabase
          .from("users")
          .select("id, username, name, role")
          .eq("username", username.toLowerCase().trim())
          .eq("pin", pin)
          .eq("is_active", true)
          .single();

        if (error || !data) {
          return { success: false, error: "Username atau PIN salah" };
        }

        set({
          user: {
            id: data.id,
            username: data.username,
            name: data.name,
            role: data.role as UserRole,
          },
        });
        return { success: true };
      },

      logout: () => set({ user: null }),

      canAccess: (page: string) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === "owner") return true;
        if (user.role === "admin") {
          return !OWNER_PAGES.includes(page);
        }
        return page === "kasir";
      },
    }),
    {
      name: "wnp-auth-v3",
      partialize: (state) => ({ user: state.user }),
    }
  )
);