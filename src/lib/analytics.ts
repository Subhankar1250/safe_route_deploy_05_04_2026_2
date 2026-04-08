"use client";

import { sendGAEvent } from "@next/third-parties/google";
import { trackFirebaseEvent } from "@/lib/firebaseAnalytics";

type EventParams = Record<string, string | number | boolean | null | undefined>;

export function trackEvent(name: string, params?: EventParams) {
  if (process.env.NEXT_PUBLIC_GA_ID) {
    sendGAEvent("event", name, params ?? {});
  }
  void trackFirebaseEvent(name, params);
}

