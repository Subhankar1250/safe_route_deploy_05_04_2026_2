"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";

type EventParams = Record<string, string | number | boolean | null | undefined>;

/** Fallbacks: Firebase web app `saferoute-97776` (override via NEXT_PUBLIC_FIREBASE_* env vars). */
function getFirebaseWebConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDZz9KUQrNavq5NCbdBJPwFL8WWTElDT3Y",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "saferoute-97776.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "saferoute-97776",
    storageBucket:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "saferoute-97776.firebasestorage.app",
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "670285626876",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:670285626876:web:e41454af5cd53583938679",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-SE6C74XXWG",
  };
}

function getOrInitFirebaseApp(): FirebaseApp {
  const existing = getApps();
  if (existing.length > 0) return getApp();
  return initializeApp(getFirebaseWebConfig());
}

export async function trackFirebaseEvent(
  name: string,
  params?: EventParams,
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const [{ isSupported, getAnalytics, logEvent }] = await Promise.all([
      import("firebase/analytics"),
    ]);
    const supported = await isSupported();
    if (!supported) return;
    const app = getOrInitFirebaseApp();
    const analytics = getAnalytics(app);
    logEvent(analytics, name, params ?? {});
  } catch {
    // Keep analytics non-blocking
  }
}

