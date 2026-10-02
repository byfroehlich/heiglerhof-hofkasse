import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "./env";

let admin: SupabaseClient | null = null;

/** Service-Role-Client: umgeht RLS. Nur im Server verwenden, nie an den Client geben. */
export function db(): SupabaseClient {
  admin ??= createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/** Auth-Client mit den Cookies der Anfrage, nur für Login und Session. */
export async function authClient() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const c of list) store.set(c.name, c.value, c.options);
        } catch {
          // In Server Components dürfen keine Cookies gesetzt werden; der Proxy erneuert die Session.
        }
      },
    },
  });
}

export function fotoUrl(path: string | null): string | null {
  if (!path) return null;
  return `${env.supabaseUrl}/storage/v1/object/public/produktfotos/${path}`;
}
