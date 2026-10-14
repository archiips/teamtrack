import type { NextConfig } from "next";
const config: NextConfig = {
  async headers() {
    let origin = "";
    try {
      origin = JSON.parse(process.env.LTI_REGISTRATION || "{}").origin || "";
    } catch {}
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors 'self' ${origin}; object-src 'none'; base-uri 'self'`,
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
