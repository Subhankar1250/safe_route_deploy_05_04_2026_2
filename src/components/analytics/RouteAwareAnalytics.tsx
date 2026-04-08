"use client";

import Script from "next/script";
import { GoogleAnalytics } from "@next/third-parties/google";
import { usePathname } from "next/navigation";

const DEFAULT_CLARITY = "w89u87ruz4";

/**
 * Loads one GA4 property + one Clarity project per page view.
 * Under `/admin`, uses `NEXT_PUBLIC_GA_ID_ADMIN` / `NEXT_PUBLIC_CLARITY_ID_ADMIN` when set,
 * otherwise falls back to the main site IDs so a single-property setup still works.
 */
export function RouteAwareAnalytics() {
  const pathname = usePathname() || "";
  const isAdmin = pathname.startsWith("/admin");

  const mainGa = process.env.NEXT_PUBLIC_GA_ID?.trim() || "";
  const adminGa = process.env.NEXT_PUBLIC_GA_ID_ADMIN?.trim() || "";
  const mainClarity =
    process.env.NEXT_PUBLIC_CLARITY_ID?.trim() || DEFAULT_CLARITY;
  const adminClarity = process.env.NEXT_PUBLIC_CLARITY_ID_ADMIN?.trim() || "";

  const gaId = isAdmin ? adminGa || mainGa : mainGa;
  const clarityId =
    isAdmin && adminClarity ? adminClarity : mainClarity;

  return (
    <>
      {gaId ? <GoogleAnalytics key={gaId} gaId={gaId} /> : null}
      <Script
        id="ms-clarity-route"
        key={clarityId}
        strategy="afterInteractive"
      >
        {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "${clarityId}");`}
      </Script>
    </>
  );
}
