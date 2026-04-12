import { useEffect, useRef, useState } from "react";
import { fetchDrivingRouteMeters, type LatLng } from "@/services/roadDrivingRoute";
import { calculateDistanceMeters } from "@/utils/locationUtils";

export type RoadDistanceState = {
  /** Driving distance in meters (OSRM) or straight-line fallback. */
  distanceMeters: number | null;
  durationSeconds: number | null;
  loading: boolean;
  /** True when the current distance came from the routing API. */
  isRoad: boolean;
  /** At least one estimate (road or fallback) has been computed for the current endpoints. */
  hasFirstEstimate: boolean;
};

/**
 * Debounced driving distance between two points. Falls back to Haversine meters if routing fails.
 */
export function useRoadDistanceBetween(
  a: LatLng | null,
  b: LatLng | null,
  opts?: { enabled?: boolean; debounceMs?: number },
): RoadDistanceState {
  const enabled = opts?.enabled !== false;
  const debounceMs = opts?.debounceMs ?? 1300;

  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRoad, setIsRoad] = useState(false);
  const [hasFirstEstimate, setHasFirstEstimate] = useState(false);
  const routeCacheRef = useRef<{
    key: string;
    at: number;
    meters: number;
    sec: number | null;
    road: boolean;
  } | null>(null);
  const CACHE_MS = 45_000;

  useEffect(() => {
    if (!enabled || !a || !b) {
      setDistanceMeters(null);
      setDurationSeconds(null);
      setLoading(false);
      setIsRoad(false);
      setHasFirstEstimate(false);
      return;
    }

    const straightM = calculateDistanceMeters(a.lat, a.lng, b.lat, b.lng);
    let cancelled = false;

    const debounceTimer = window.setTimeout(() => {
      void (async () => {
        const coordKey = [a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(4)).join("|");
        const cached = routeCacheRef.current;
        if (cached && cached.key === coordKey && Date.now() - cached.at < CACHE_MS) {
          setDistanceMeters(cached.meters);
          setDurationSeconds(cached.sec);
          setIsRoad(cached.road);
          setHasFirstEstimate(true);
          setLoading(false);
          return;
        }

        const ac = new AbortController();
        const abortTimer = window.setTimeout(() => ac.abort(), 12_000);
        setLoading(true);
        try {
          const route = await fetchDrivingRouteMeters(a, b, ac.signal);
          if (cancelled) return;
          if (route) {
            routeCacheRef.current = {
              key: coordKey,
              at: Date.now(),
              meters: route.distanceMeters,
              sec: route.durationSeconds,
              road: true,
            };
            setDistanceMeters(route.distanceMeters);
            setDurationSeconds(route.durationSeconds);
            setIsRoad(true);
          } else {
            routeCacheRef.current = {
              key: coordKey,
              at: Date.now(),
              meters: straightM,
              sec: null,
              road: false,
            };
            setDistanceMeters(straightM);
            setDurationSeconds(null);
            setIsRoad(false);
          }
          setHasFirstEstimate(true);
        } catch {
          if (cancelled) return;
          routeCacheRef.current = {
            key: coordKey,
            at: Date.now(),
            meters: straightM,
            sec: null,
            road: false,
          };
          setDistanceMeters(straightM);
          setDurationSeconds(null);
          setIsRoad(false);
          setHasFirstEstimate(true);
        } finally {
          clearTimeout(abortTimer);
          if (!cancelled) setLoading(false);
        }
      })();
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
    };
  }, [enabled, a?.lat, a?.lng, b?.lat, b?.lng, debounceMs]);

  return {
    distanceMeters,
    durationSeconds,
    loading,
    isRoad,
    hasFirstEstimate,
  };
}
