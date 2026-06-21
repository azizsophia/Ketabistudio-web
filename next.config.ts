import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the (non-public) I Am print templates are bundled with the template
  // route's serverless function, so it can read them at runtime on Vercel.
  outputFileTracingIncludes: {
    "/api/iam/template": ["./iam-templates/**"],
  },
};

export default nextConfig;
