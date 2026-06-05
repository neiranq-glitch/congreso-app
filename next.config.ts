import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    // camera=() left open intentionally only for QR scanner route — override per-route if needed
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires 'unsafe-inline' for styles in dev; tighten with nonce in production if needed
      "style-src 'self' 'unsafe-inline'",
      // Next.js hydration requires 'unsafe-eval' only in development
      process.env.NODE_ENV === "development"
        ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
        : "script-src 'self'",
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""} wss://*.supabase.co`,
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
