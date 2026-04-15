import { supabase } from "./supabase";

export async function verifyVoidKey(input: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "void_key")
      .single();
    if (!data) return false;
    return data.value === input.trim();
  } catch {
    return false;
  }
}

export async function getVoidKey(): Promise<string> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "void_key")
    .single();
  return data?.value ?? "";
}

export async function setVoidKey(newKey: string): Promise<boolean> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "void_key", value: newKey.trim(), updated_at: new Date().toISOString() });
  return !error;
}