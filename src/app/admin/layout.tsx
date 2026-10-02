import type { Metadata, Viewport } from "next";
import { SwRegistrieren } from "@/components/app-push";

// Admin als installierbare App „Hofkasse“ (Startbildschirm auf Android und iPhone)
export const metadata: Metadata = {
  title: "Hofkasse",
  manifest: "/hofkasse.webmanifest",
  appleWebApp: { capable: true, title: "Hofkasse", statusBarStyle: "default" },
  icons: { icon: [{ url: "/icons/hofkasse-192.png", sizes: "192x192" }], apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }] },
};

export const viewport: Viewport = { themeColor: "#F6C843" };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <>{children}<SwRegistrieren /></>;
}
