import type { NextConfig } from "next";

// Athlete photos live in this project's Supabase storage. Only that host goes through Next's image optimizer
// (resized to the size shown, modern formats), so nobody can spend our quota on other images.
const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://invalid.supabase.co").hostname;

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    // Public and signed (`/object/sign/…?token=…`) storage links — production's photos are signed
    remotePatterns: [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/**" }],
    // A new photo gets a new file name, so a resized copy never goes stale
    minimumCacheTTL: 60 * 60 * 24 * 31,
  },
};

export default nextConfig;
