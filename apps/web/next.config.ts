import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { config } from "dotenv";

config();

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost"
      },
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  },
  async rewrites() {
    // Même origine en dev : /api/* est proxifié vers le backend (ARCH §5.1).
    // En prod, Caddy assure ce routage (J9) — la rewrite reste sans effet derrière lui.
    const target = process.env.INTERNAL_API_URL ?? "http://localhost:8000";
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  }
};

export default withNextIntl(nextConfig);
