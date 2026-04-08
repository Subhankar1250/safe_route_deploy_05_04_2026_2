"use client";

import { sendGAEvent } from "@next/third-parties/google";
import { trackFirebaseEvent } from "@/lib/firebaseAnalytics";

type EventParams = Record<string, string | number | boolean | null | undefined>;

export function trackEvent(name: string, params?: EventParams) {
  const hasGa =
    Boolean(process.env.NEXT_PUBLIC_GA_ID?.trim()) ||
    Boolean(process.env.NEXT_PUBLIC_GA_ID_ADMIN?.trim());
  if (hasGa) {
    sendGAEvent("event", name, params ?? {});
  }
  void trackFirebaseEvent(name, params);
}

