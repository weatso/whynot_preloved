import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "./supabase";
import type { UserRole } from "./supabase";

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  tenant_id: string;
}

export interface TenantBranding {
  name: string;
  logoUrl: string | null;
  receiptFooter: string | null;
}

interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  tenantBranding: TenantBranding | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;
  logout: () => void;
  canAccess: (page: string) => boolean;
}

const OWNER_PAGES = ["settlement", "audit", "generate", "events", "vendors", "discounts", "settings"];

import { loginWithPassword, logoutFromServer } from "../app/actions/auth";

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      tenantBranding: null,

      login: async (username, password) => {
        try {
          const result = await loginWithPassword(username, password);
          
          if (!result.success || !result.token || !result.user) {
            return { success: false, error: result.error || "Gagal masuk" };
          }

          const authUser = {
            id: result.user.id,
            username: result.user.username,
            name: result.user.name,
            role: result.user.role as UserRole,
            tenant_id: result.user.tenant_id,
          };
          set({
            token: result.token,
            user: authUser,
            tenantBranding: result.branding || null,
          });
          return { success: true, user: authUser };
        } catch (error) {
          console.error("Login Error:", error);
          return { success: false, error: "Terjadi kesalahan pada server" };
        }
      },

      logout: async () => {
        // 1. Clear server-side HttpOnly cookie
        try {
          await logoutFromServer();
        } catch (e) {
          console.error("Logout from server failed:", e);
        }

        // 2. Clear local state
        set({ token: null, user: null, tenantBranding: null });
        
        // 3. Nuke everything in storage and redirect
        if (typeof window !== "undefined") {
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = "/login";
        }
      },

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
      name: "wnp-auth-v4",
      partialize: (state) => ({ token: state.token, user: state.user, tenantBranding: state.tenantBranding }),
    }
  )
);