import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : "*.supabase.co";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/produktfotos/**" }],
  },
  // Schriften fürs Verkaufsschild (PDF) mit in die Serverfunktion packen
  outputFileTracingIncludes: { "/admin/schild/[id]": ["./assets/fonts/*.ttf"] },
  experimental: {
    // Produktfotos kommen schon im Browser verkleinert an (rund 100 bis 300 KB).
    serverActions: { bodySizeLimit: "3mb" },
  },
  // Umzug zu TRULOC: alte QR Codes und Nachbestell-Links weiterleiten. Nicht dauerhaft (307),
  // damit wir zurück können, falls etwas hakt. TRULOC findet die Stelle über den alten Kurznamen.
  async redirects() {
    return [
      { source: "/kasse/:slug", destination: "https://www.truloc.de/kasse/:slug", permanent: false },
      { source: "/nachbestellen/:token", destination: "https://www.truloc.de/nachbestellen/:token", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/admin-sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" }, // nur die eigene App darf die Kasse einbetten (Vorschau im Admin)
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
