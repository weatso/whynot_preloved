"use server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

// Initialize Supabase Service Role client (bypasses RLS)
const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Verify if the requesting user has the superadmin role
 */
async function verifySuperadmin() {
  const cookieStore = cookies();
  const token = (await cookieStore).get("sb-token")?.value;
  if (!token) return false;

  try {
    // Decoding JWT manually or via Supabase (manual is safer here for role verification)
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    return payload.app_role === "superadmin";
  } catch (e) {
    return false;
  }
}

export async function getGlobalDashboardData() {
  const isAdmin = await verifySuperadmin();
  if (!isAdmin) throw new Error("Unauthorized");

  // 1. Total Tenants
  const { count: tenantCount } = await supabaseService
    .from("tenants")
    .select("*", { count: "exact", head: true });

  // 2. Total Gross Revenue & Transactions
  const { data: txns } = await supabaseService
    .from("transactions")
    .select("total_amount")
    .eq("status", "completed");

  const grossRevenue = txns?.reduce((sum, t) => sum + Number(t.total_amount), 0) || 0;
  const platformFee = Math.round(grossRevenue * 0.05); // 5% Platform Cut

  // 3. Total Items
  const { count: itemCount } = await supabaseService
    .from("items")
    .select("*", { count: "exact", head: true });

  return {
    tenantCount: tenantCount || 0,
    grossRevenue,
    platformFee,
    itemCount: itemCount || 0,
    transactionCount: txns?.length || 0
  };
}

export async function getTenantsList() {
  const isAdmin = await verifySuperadmin();
  if (!isAdmin) throw new Error("Unauthorized");

  // Fetch tenants with transaction sums AND their owner username
  const { data: tenants, error } = await supabaseService
    .from("tenants")
    .select(`
      id, name, slug, is_active, subscription_valid_until, created_at,
      transactions ( total_amount, status ),
      users!users_tenant_id_fkey ( username, role )
    `);

  if (error) throw error;

  return tenants.map(t => {
    const activeTxns = (t.transactions as any[])?.filter(tx => tx.status === "completed") || [];
    const revenue = activeTxns.reduce((sum, tx) => sum + Number(tx.total_amount), 0);
    const owner = (t.users as any[])?.find((u: any) => u.role === "owner");

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      isActive: t.is_active,
      subscriptionValidUntil: t.subscription_valid_until,
      createdAt: t.created_at,
      revenue,
      platformCut: Math.round(revenue * 0.05),
      txnCount: activeTxns.length,
      ownerUsername: owner?.username || "—",
    };
  }).sort((a, b) => b.revenue - a.revenue);
}

export async function registerTenant(tenantName: string, slug: string, ownerUsername: string, ownerPassword: string, subscriptionDays: number) {
  const isAdmin = await verifySuperadmin();
  if (!isAdmin) throw new Error("Unauthorized");

  // 1. Create Tenant
  const { data: tenant, error: tError } = await supabaseService
    .from("tenants")
    .insert({
      name: tenantName,
      slug: slug.toLowerCase().trim(),
      subscription_valid_until: new Date(Date.now() + subscriptionDays * 24 * 60 * 60 * 1000).toISOString()
    })
    .select()
    .single();

  if (tError) throw tError;

  // 2. Hash the password using pgcrypto on the database
  let hashed = ownerPassword;
  const { data: hashResult, error: hError } = await supabaseService
    .rpc("hash_password", { p_plain_password: ownerPassword });
  
  if (hError) {
    console.error("[REGISTER] hash_password RPC failed:", hError.message);
    throw new Error("Gagal mengenkripsi password");
  }
  hashed = hashResult;

  // 3. Create Owner User with hashed password
  const { error: uError } = await supabaseService
    .from("users")
    .insert({
      tenant_id: tenant.id,
      username: ownerUsername.toLowerCase().trim(),
      password_hash: hashed,
      name: `${tenantName} Owner`,
      role: "owner"
    });

  if (uError) throw uError;

  return { success: true, tenantId: tenant.id };
}

export async function impersonateTenant(tenantId: string) {
  const isAdmin = await verifySuperadmin();
  if (!isAdmin) throw new Error("Unauthorized");

  // 1. Fetch the owner of the target tenant
  const { data: ownerUser, error } = await supabaseService
    .from("users")
    .select("id, username, name, role, tenant_id")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .limit(1)
    .single();

  if (error || !ownerUser) throw new Error("No owner found for this tenant");

  // 2. Fetch tenant branding
  const { data: tenant } = await supabaseService
    .from("tenants")
    .select("name, logo_url, receipt_footer")
    .eq("id", tenantId)
    .single();

  // 3. Generate a JWT for the owner
  const payload = {
    sub: ownerUser.id,
    role: "authenticated",
    app_role: ownerUser.role,
    tenant_id: ownerUser.tenant_id,
    impersonated_by: "superadmin",
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4, // 4 hour session
  };

  const token = jwt.sign(payload, process.env.SUPABASE_JWT_SECRET!);

  // 4. Set the cookie
  const cookieStore = await cookies();
  cookieStore.set("sb-token", token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 4,
  });

  return {
    success: true,
    token,
    user: {
      id: ownerUser.id,
      username: ownerUser.username,
      name: ownerUser.name,
      role: ownerUser.role,
      tenant_id: ownerUser.tenant_id,
    },
    branding: tenant ? {
      name: tenant.name,
      logoUrl: (tenant as any).logo_url,
      receiptFooter: (tenant as any).receipt_footer,
    } : { name: "Shop", logoUrl: null, receiptFooter: null }
  };
}

export async function resetOwnerPassword(tenantId: string, newPassword: string) {
  const isAdmin = await verifySuperadmin();
  if (!isAdmin) throw new Error("Unauthorized");

  // 1. Fetch the owner of the target tenant
  const { data: ownerUser, error: fetchError } = await supabaseService
    .from("users")
    .select("id, username")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .limit(1)
    .single();

  if (fetchError || !ownerUser) throw new Error("No owner found for this tenant");

  // 2. Hash the password using pgcrypto
  let hashed = newPassword;
  const { data: hashResult, error: hError } = await supabaseService
    .rpc("hash_password", { p_plain_password: newPassword });
  
  if (hError) throw new Error("Gagal mengenkripsi password");
  hashed = hashResult;

  // 3. Update the owner's password
  const { error: updateError } = await supabaseService
    .from("users")
    .update({ password_hash: hashed })
    .eq("id", ownerUser.id);

  if (updateError) throw updateError;

  return { success: true, username: ownerUser.username, resetTo: newPassword };
}

export async function toggleTenantStatus(tenantId: string, status: boolean) {
  const isAdmin = await verifySuperadmin();
  if (!isAdmin) throw new Error("Unauthorized");

  const { error } = await supabaseService
    .from("tenants")
    .update({ is_active: status })
    .eq("id", tenantId);

  if (error) throw error;
  return { success: true };
}

export async function createBroadcast(message: string, type: "info" | "warning" | "critical") {
  const isAdmin = await verifySuperadmin();
  if (!isAdmin) throw new Error("Unauthorized");

  const { error } = await supabaseService
    .from("broadcasts")
    .insert({ message, type });

  if (error) throw error;
  return { success: true };
}

export async function getActiveBroadcasts() {
  // Public access, but we fetch via service role to ensure all active ones are seen
  const { data, error } = await supabaseService
    .from("broadcasts")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data;
}

export async function getGlobalAuditLogs(page: number = 0, pageSize: number = 20) {
  const isAdmin = await verifySuperadmin();
  if (!isAdmin) throw new Error("Unauthorized");

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabaseService
    .from("audit_logs")
    .select(`
      *,
      tenants ( name )
    `)
    .order("timestamp", { ascending: false })
    .range(from, to);

  if (error) throw error;
  return data;
}
