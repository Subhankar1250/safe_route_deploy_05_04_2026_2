import { useEffect, useRef, useState } from "react";
import { calculateDistanceMeters } from "@/utils/locationUtils";
import { isNativeAndroidApp } from "@/lib/nativeAndroidApp";

export type ProximityAlarmState = {
  distanceMeters: number | null;
  isInside: boolean;
  lastTriggeredAt: number | null;
};

type Params = {
  enabled: boolean;
  guardianLocation: { latitude: number; longitude: number } | null;
  driverLocation: { latitude: number; longitude: number } | null;
  radiusMeters?: number;
  cooldownMs?: number;
  onTriggered?: (distanceMeters: number) => void;
};

async function vibrateAndBeep(): Promise<void> {
  // Vibration (Android Capacitor preferred; browser fallback)
  try {
    if (isNativeAndroidApp()) {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await Haptics.vibrate({ duration: 1200 });
      await Haptics.vibrate({ duration: 1200 });
    } else if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean }).vibrate?.([400, 200, 800, 200, 1200]);
    }
  } catch {
    /* ignore */
  }

  // Loud-ish beep (may be blocked until a user gesture on some devices/browsers)
  try {
    if (typeof window === "undefined") return;
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.25;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      try {
        osc.stop();
        ctx.close().catch(() => {});
      } catch {
        /* ignore */
      }
    }, 1200);
  } catch {
    /* ignore */
  }
}

/**
 * Guardian 500m alert.
 * Triggers only on entry (outside → inside) with a cooldown.
 */
export function useProximityAlarm(params: Params): ProximityAlarmState {
  const {
    enabled,
    guardianLocation,
    driverLocation,
    radiusMeters = 500,
    cooldownMs = 5 * 60 * 1000,
    onTriggered,
  } = params;

  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isInside, setIsInside] = useState(false);
  const lastTriggeredAtRef = useRef<number | null>(null);
  const prevInsideRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;
    if (!guardianLocation || !driverLocation) {
      setDistanceMeters(null);
      setIsInside(false);
      prevInsideRef.current = false;
      return;
    }

    const d = calculateDistanceMeters(
      guardianLocation.latitude,
      guardianLocation.longitude,
      driverLocation.latitude,
      driverLocation.longitude,
    );

    if (!Number.isFinite(d)) {
      setDistanceMeters(null);
      setIsInside(false);
      prevInsideRef.current = false;
      return;
    }

    setDistanceMeters(d);
    const inside = d <= radiusMeters;
    setIsInside(inside);

    const prevInside = prevInsideRef.current;
    prevInsideRef.current = inside;

    if (!prevInside && inside) {
      const now = Date.now();
      const last = lastTriggeredAtRef.current;
      if (last == null || now - last >= cooldownMs) {
        lastTriggeredAtRef.current = now;
        onTriggered?.(d);
        void vibrateAndBeep();
      }
    }
  }, [enabled, guardianLocation, driverLocation, radiusMeters, cooldownMs, onTriggered]);

  return {
    distanceMeters,
    isInside,
    lastTriggeredAt: lastTriggeredAtRef.current,
  };
}

