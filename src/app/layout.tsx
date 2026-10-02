import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Vollkorn, Caveat_Brush } from "next/font/google";
import "./globals.css";

const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-barlow" });
const vollkorn = Vollkorn({ subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"], variable: "--font-vollkorn" });
const caveat = Caveat_Brush({ subsets: ["latin"], weight: "400", variable: "--font-caveat" });

export const metadata: Metadata = {
  title: "Hofkasse · Heiglerhof",
  description: "Handgemachtes vom Heiglerhof aus Nesselwang direkt vor Ort kaufen.",
  robots: { index: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#e48500" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${barlow.variable} ${vollkorn.variable} ${caveat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
