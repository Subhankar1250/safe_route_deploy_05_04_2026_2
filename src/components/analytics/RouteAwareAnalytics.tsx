"use client";

import Clarity from "@microsoft/clarity";
import { GoogleAnalytics } from "@next/third-parties/google";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const DEFAULT_CLARITY = "w89u87ruz4";

function readStoredUserForClarity(): { id: string; friendlyName: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("sishu_tirtha_user");
    if (!raw) return null;
    const u = JSON.parse(raw) as {
      id?: string;
      username?: string;
      user_type?: string;
    };
    if (!u.id) return null;
    const friendlyName = [u.user_type, u.username].filter(Boolean).join(" · ") || u.id;
    return { id: u.id, friendlyName };
  } catch {
    return null;
  }
}

/**
 * GA4 via @next/third-parties; Microsoft Clarity via @microsoft/clarity (official SDK).
 * `/admin` can use separate GA + Clarity project IDs when env vars are set.
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

  const lastClarityProjectRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const switchingProject =
      lastClarityProjectRef.current !== null &&
      lastClarityProjectRef.current !== clarityId;

    if (switchingProject) {
      document.getElementById("clarity-script")?.remove();
    }
    lastClarityProjectRef.current = clarityId;

    try {
      Clarity.init(clarityId);
    } catch {
      /* non-blocking */
    }
  }, [clarityId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const u = readStoredUserForClarity();
        if (u) {
          Clarity.identify(u.id, undefined, pathname, u.friendlyName);
        }
      } catch {
        /* ignore */
      }
    }, 150);
    return () => window.clearTimeout(id);
  }, [pathname, clarityId]);

  return (
    <>
      {gaId ? <GoogleAnalytics key={gaId} gaId={gaId} /> : null}
    </>
  );
}
