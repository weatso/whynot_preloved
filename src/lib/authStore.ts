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
  verifyVoidKey: (key: string) => Promise<boolean>;
}

const OWNER_PAGES = ["settlement", "audit", "generate", "events", "vendors", "discounts", "settings"];
const ADMIN_PAGES = ["users", "stock"];

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
        // kasir can only access kasir page
        return page === "kasir";
      },

      verifyVoidKey: async (key: string) => {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "void_key")
          .single();
        return data?.value === key;
      },
    }),
    {
      name: "wnp-auth-v3",
      partialize: (state) => ({ user: state.user }),
    }
  )
);

export function canRole(role: UserRole | undefined, requiredPages: string[]): boolean {
  if (!role) return false;
  if (role === "owner") return true;
  if (role === "admin") return !requiredPages.some(p => OWNER_PAGES.includes(p));
  return false;
}