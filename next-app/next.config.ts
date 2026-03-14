import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Ensure markdown docs outside the next-app/ root are included in
  // Vercel's serverless function bundle (needed when docs/ sits at repo root)
  outputFileTracingRoot: path.join(__dirname, "../"),
  outputFileTracingIncludes: {
    "/knowledge": ["../docs/knowledge-base/unfpa/**/*.md"],
    "/knowledge/[slug]": ["../docs/knowledge-base/unfpa/**/*.md"],
  },
};

export default nextConfig;
