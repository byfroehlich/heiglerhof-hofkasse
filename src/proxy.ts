import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Erneuert die Supabase-Session und schickt nicht angemeldete Besucher von /admin zum Login.
// Das ist nur eine schnelle Vorprüfung: jede Admin-Seite und jede Aktion prüft selbst mit requireAdmin().
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const c of list) request.cookies.set(c.name, c.value);
        response = NextResponse.next({ request });
        for (const c of list) response.cookies.set(c.name, c.value, c.options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const isLogin = request.nextUrl.pathname.startsWith("/admin/login");
  if (!data.user && !isLogin) return NextResponse.redirect(new URL("/admin/login", request.url));
  return response;
}

export const config = { matcher: ["/admin/:path*"] };
