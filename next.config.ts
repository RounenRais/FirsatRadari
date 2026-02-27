import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["puppeteer", "playwright", "iconv-lite"],
};

export default nextConfig;
