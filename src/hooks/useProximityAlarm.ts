import { useEffect, useRef, useState } from "react";
import { calculateDistanceMeters } from "@/utils/locationUtils";
import {
  startProximityAlarmSession,
  stopProximityAlarmSession,
} from "@/lib/proximityAlarmSession";

export type ProximityBand = 500 | 200 | 100;

export type ProximityAlarmState = {
  distanceMeters: number | null;
  /** True when the bus is within the outer 500 m zone. */
  isInside: boolean;
  lastTriggeredAt: number | null;
};

const BANDS: ProximityBand[] = [500, 200, 100];
const BAND_COOLDOWN_MS = 25_000;

type Params = {
  enabled: boolean;
  guardianLocation: { latitude: number; longitude: number } | null;
  driverLocation: { latitude: number; longitude: number } | null;
  onTriggered?: (info: { band: ProximityBand; distanceMeters: number }) => void;
  /**
   * When set, band logic uses driving distance along roads (meters) instead of straight-line Haversine.
   * While `ready` is false, crossing detection stays disarmed (waits for first route or fallback).
   */
  drivingDistance?: { meters: number; ready: boolean };
};

/**
 * Guardian proximity alerts at 500 m, 200 m, and 100 m (inward crossing).
 * Each trigger starts a loud ~2-minute alarm session (replaces any previous session).
 */
export function useProximityAlarm(params: Params): ProximityAlarmState {
  const { enabled, guardianLocation, driverLocation, onTriggered, drivingDistance } = params;

  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isInside, setIsInside] = useState(false);
  const lastTriggeredAtRef = useRef<number | null>(null);
  const prevDistanceRef = useRef<number | null>(null);
  const lastBandFireRef = useRef<Partial<Record<ProximityBand, number>>>({});
  const coordKeyRef = useRef<string>("");

  const onTriggeredRef = useRef(onTriggered);
  onTriggeredRef.current = onTriggered;

  useEffect(() => {
    if (!enabled) {
      stopProximityAlarmSession();
      prevDistanceRef.current = null;
      lastBandFireRef.current = {};
      setDistanceMeters(null);
      setIsInside(false);
      return;
    }
    if (!guardianLocation || !driverLocation) {
      prevDistanceRef.current = null;
      setDistanceMeters(null);
      setIsInside(false);
      return;
    }

    const straightM = calculateDistanceMeters(
      guardianLocation.latitude,
      guardianLocation.longitude,
      driverLocation.latitude,
      driverLocation.longitude,
    );

    const coordKey = [
      guardianLocation.latitude,
      guardianLocation.longitude,
      driverLocation.latitude,
      driverLocation.longitude,
    ]
      .map((n) => n.toFixed(3))
      .join("|");
    if (coordKeyRef.current !== coordKey) {
      coordKeyRef.current = coordKey;
      prevDistanceRef.current = null;
    }

    if (drivingDistance && !drivingDistance.ready) {
      if (Number.isFinite(straightM)) {
        setDistanceMeters(straightM);
        setIsInside(straightM <= 500);
      }
      return;
    }

    const d =
      drivingDistance?.ready && Number.isFinite(drivingDistance.meters)
        ? drivingDistance.meters
        : straightM;

    if (!Number.isFinite(d)) {
      prevDistanceRef.current = null;
      setDistanceMeters(null);
      setIsInside(false);
      return;
    }

    setDistanceMeters(d);
    setIsInside(d <= 500);

    const prev = prevDistanceRef.current;
    prevDistanceRef.current = d;

    if (prev == null || !Number.isFinite(prev)) {
      return;
    }

    const now = Date.now();

    for (const band of BANDS) {
      if (!(prev > band && d <= band)) continue;
      const last = lastBandFireRef.current[band];
      if (last != null && now - last < BAND_COOLDOWN_MS) continue;
      lastBandFireRef.current[band] = now;
      lastTriggeredAtRef.current = now;
      onTriggeredRef.current?.({ band, distanceMeters: d });
      startProximityAlarmSession();
    }
  }, [enabled, guardianLocation, driverLocation, drivingDistance?.meters, drivingDistance?.ready]);

  useEffect(() => {
    return () => {
      stopProximityAlarmSession();
    };
  }, []);

  return {
    distanceMeters,
    isInside,
    lastTriggeredAt: lastTriggeredAtRef.current,
  };
}
