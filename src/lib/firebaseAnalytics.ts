"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";

type EventParams = Record<string, string | number | boolean | null | undefined>;

function getFirebaseWebConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCcX9sXvi_AIyAqhL1qPD0TY-e82mdXZHo",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "saferoute-99504.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "saferoute-99504",
    storageBucket:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "saferoute-99504.firebasestorage.app",
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "746687651452",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:746687651452:web:42d8e60fa6400ffb3f33f9",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-9G80QE4D28",
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

