import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Server-only client — uses service role key, bypasses RLS
// NEVER import this file in client components or expose to the browser
export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY — this client must only run server-side"
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}
