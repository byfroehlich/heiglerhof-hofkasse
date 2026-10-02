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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
