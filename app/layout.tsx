import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { RouteAwareAnalytics } from "@/components/analytics/RouteAwareAnalytics";
import { AppProvidersLazy } from "@/components/providers/AppProvidersLazy";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://saferoute.sishutirtha.co.in";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Sishu Tirtha Safe Route",
  description: "Real-time school transport tracking for parents and administrators",
  authors: [{ name: "The Phoenix Devs" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      {
        url: "/lovable-uploads/5660de73-133f-4d61-aa57-08b2be7b455d.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/lovable-uploads/5660de73-133f-4d61-aa57-08b2be7b455d.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Safe Route",
  },
  openGraph: {
    title: "Sishu Tirtha Safe Route",
    description: "Real-time school transport tracking for parents and administrators",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <style
          dangerouslySetInnerHTML={{
            __html: `
              *,*::before,*::after{box-sizing:border-box}
              .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0}
            `,
          }}
        />
        <AppProvidersLazy>{children}</AppProvidersLazy>
        <RouteAwareAnalytics />
        {process.env.NEXT_PUBLIC_HOTJAR_ID && process.env.NEXT_PUBLIC_HOTJAR_SV ? (
          <Script id="hotjar" strategy="afterInteractive">
            {`(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${process.env.NEXT_PUBLIC_HOTJAR_ID},hjsv:${process.env.NEXT_PUBLIC_HOTJAR_SV}};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`}
          </Script>
        ) : null}
        {process.env.NEXT_PUBLIC_SMARTLOOK_PROJECT_KEY ? (
          <Script id="smartlook" strategy="afterInteractive">
            {`window.smartlook||(function(d){var o=smartlook=function(){o.api.push(arguments)},h=d.getElementsByTagName('head')[0];var c=d.createElement('script');o.api=[];c.async=true;c.type='text/javascript';c.charset='utf-8';c.src='https://web-sdk.smartlook.com/recorder.js';h.appendChild(c);})(document);smartlook('init', '${process.env.NEXT_PUBLIC_SMARTLOOK_PROJECT_KEY}');`}
          </Script>
        ) : null}
      </body>
    </html>
  );
}
