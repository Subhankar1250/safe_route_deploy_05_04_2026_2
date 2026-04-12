import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const rawBase =
  process.env.NEXT_BASE_PATH?.trim() ||
  process.env.NEXT_PUBLIC_BASE_PATH?.trim() ||
  "";
const basePath =
  !rawBase || rawBase === "/"
    ? undefined
    : (rawBase.startsWith("/") ? rawBase : `/${rawBase}`).replace(/\/$/, "") || undefined;

/** CDN or alternate origin for /_next/static (rare); must match deployment. */
const assetPrefixRaw = process.env.NEXT_PUBLIC_ASSET_PREFIX?.trim();
const assetPrefix = assetPrefixRaw && assetPrefixRaw !== "/" ? assetPrefixRaw.replace(/\/$/, "") : undefined;

/**
 * Static HTML export is **opt-in** (`NEXT_STATIC_EXPORT=1`). Use it only for Capacitor `webDir`
 * (`npm run build:static`) or static hosting of `out/`.
 *
 * Default `next build` produces a normal `.next` app so `next start` serves `/_next/static/*`
 * correctly. Always exporting caused broken styling when people ran `next start` or another
 * server that expected a Node Next app instead of the `out/` folder.
 */
const staticExport =
  process.env.NEXT_STATIC_EXPORT === "1" ||
  process.env.NEXT_STATIC_EXPORT === "true";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), geolocation=(self), microphone=(), payment=()",
  },
];

if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig = {
  reactStrictMode: true,
  ...(staticExport ? { output: "export" } : {}),
  ...(basePath ? { basePath } : {}),
  ...(assetPrefix ? { assetPrefix } : {}),
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "recharts"],
  },
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.output.chunkLoadTimeout = 120000;
    }
    return config;
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withSentryConfig(nextConfig, {
 // For all available options, see:
 // https://www.npmjs.com/package/@sentry/webpack-plugin#options

 org: "the-phoenix-ud",

 project: "javascript-nextjs",

 // Only print logs for uploading source maps in CI
 silent: !process.env.CI,

 // For all available options, see:
 // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

 // Upload a larger set of source maps for prettier stack traces (increases build time)
 widenClientFileUpload: true,

 // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
 // This can increase your server load as well as your hosting bill.
 // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
 // side errors will fail.
 tunnelRoute: "/monitoring",

 webpack: {
   // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
   // See the following for more information:
   // https://docs.sentry.io/product/crons/
   // https://vercel.com/docs/cron-jobs
   automaticVercelMonitors: true,

   // Tree-shaking options for reducing bundle size
   treeshake: {
     // Automatically tree-shake Sentry logger statements to reduce bundle size
     removeDebugLogging: true,
   },
 },
});
