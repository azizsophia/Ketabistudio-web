import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the (non-public) I Am print templates are bundled with the template
  // route's serverless function, so it can read them at runtime on Vercel.
  outputFileTracingIncludes: {
    "/api/iam/template": ["./iam-templates/**"],
    // Journal digital download — the PDF lives outside public/ so it can only
    // be served through the paid-session check in this route.
    "/api/journal/download": ["./assets/downloads/**"],
  },
};

export default nextConfig;
