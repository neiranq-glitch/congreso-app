import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Browser-side singleton — uses anon key, access controlled by RLS
let client: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  client = createClient<Database>(url, key);
  return client;
}
