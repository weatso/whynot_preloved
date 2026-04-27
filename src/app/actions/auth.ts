"use server";

import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

// Menggunakan Service Role untuk membypass RLS selama pengecekan kredensial di server-side
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function loginWithPassword(username: string, password: string) {
  console.log(`[AUTH] Attempting login for username: ${username}`);
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[AUTH] Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  // 1. Fetch user by username only (never filter by plaintext password)
  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id, username, name, role, tenant_id, is_active, password_hash")
    .eq("username", username.toLowerCase().trim())
    .single();

  if (userError) {
    console.error(`[AUTH] User fetch error: ${userError.code} - ${userError.message}`);
    return { success: false, error: "Username atau Password salah" };
  }

  if (!user) {
    console.warn("[AUTH] No user found for username:", username);
    return { success: false, error: "Username atau Password salah" };
  }

  // 2. Verify Password using pgcrypto bcrypt comparison (verify_password RPC).
  const storedHash: string = user.password_hash ?? "";
  
  // Note: We always expect hashed passwords in production, 
  // but we handle verify_password RPC which safely handles the comparison.
  const { data: hashCheck, error: hashError } = await supabaseAdmin
    .rpc("verify_password", { p_stored_hash: storedHash, p_plain_password: password });

  if (hashError) {
    console.error("[AUTH] Hash verification error:", hashError.message);
    return { success: false, error: "Username atau Password salah" };
  }

  if (hashCheck !== true) {
    console.warn("[AUTH] Password mismatch for username:", username);
    return { success: false, error: "Username atau Password salah" };
  }

  // Cek apakah akun user aktif
  if (!user.is_active) {
    return { success: false, error: "Akun telah dinonaktifkan" };
  }

  // 2. Ambil data tenant secara terpisah untuk memastikan RLS tidak memblokir join
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .select("name, is_active, logo_url, receipt_footer")
    .eq("id", user.tenant_id)
    .single();

  if (tenantError) {
    console.warn(`[AUTH] Tenant fetch error: ${tenantError.message}. Proceeding with default tenant context.`);
  }

  // Cek apakah toko (tenant) aktif (Kecuali untuk superadmin)
  if (user.role !== "superadmin" && tenant && !tenant.is_active) {
    return { success: false, error: "Toko sedang dinonaktifkan oleh administrator platform" };
  }

  // 3. Generate Custom JWT Token yang memuat tenant_id & role
  const payload = {
    sub: user.id, // Subject ID diwajibkan oleh Supabase RLS
    role: "authenticated", // Diwajibkan oleh PostgREST agar query tidak gagal
    app_role: user.role, // Disimpan sebagai custom claim
    tenant_id: user.tenant_id,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // Token berlaku selama 24 jam
  };

  console.log(`[AUTH] Login successful for ${username}, tenant_id: ${user.tenant_id}`);

  // JWT Secret ditarik secara aman dari server-only environment variables
  const token = jwt.sign(payload, process.env.SUPABASE_JWT_SECRET!);

  // Simpan token di cookie untuk Server Actions (Superadmin)
  const cookieStore = await cookies();
  cookieStore.set("sb-token", token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 jam
  });

  return { 
    success: true, 
    token, 
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      tenant_id: user.tenant_id,
    },
    branding: tenant ? {
      name: tenant.name,
      logoUrl: (tenant as any).logo_url,
      receiptFooter: (tenant as any).receipt_footer,
    } : {
      name: "Why Not Preloved",
      logoUrl: null,
      receiptFooter: null,
    }
  };
}

export async function logoutFromServer() {
  const cookieStore = await cookies();
  cookieStore.set("sb-token", "", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0, // Expire immediately
  });
  return { success: true };
}
