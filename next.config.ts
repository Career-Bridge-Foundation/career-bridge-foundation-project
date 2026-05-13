import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TEMPORARY: 2026-05-13
  // TypeScript build-time checks are disabled to unblock Vercel deploys
  // while type errors in app/admin/simulations/[slug]/content/ are resolved
  // separately by the admin editor owner. Re-enable (delete this block)
  // once those errors are fixed. See Slack thread for context.
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
