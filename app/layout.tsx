import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Glabro Online Programs",
  description: "Glabro - Elevation Performance",
  // Installed on an iPhone home screen (manifest: app/manifest.ts): full screen, own name, dark status bar
  appleWebApp: { capable: true, title: "Glabro", statusBarStyle: "black" },
  // Next emits only the standard mobile-web-app-capable; iOS before 16.4 needs the apple- one
  other: { "apple-mobile-web-app-capable": "yes" },
};

// viewport-fit=cover: the athlete app pads itself with env(safe-area-inset-*) for the home bar / landscape notch
export const viewport: Viewport = {
  themeColor: "#111214",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${barlow.variable} ${barlowCondensed.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
