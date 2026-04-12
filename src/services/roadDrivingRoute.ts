/**
 * Driving distance/duration along the road network via OSRM-compatible API.
 * Default: public OSRM demo (fair-use). Override with NEXT_PUBLIC_OSRM_URL for self-hosted OSRM.
 *
 * Coordinates: WGS84 (lat/lng). OSRM expects lon,lat in the URL path.
 */

export type LatLng = { lat: number; lng: number };

const DEFAULT_OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

function osrmDrivingBaseUrl(): string {
  const raw = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_OSRM_URL?.trim() : "";
  if (!raw) return DEFAULT_OSRM_BASE;
  return raw.replace(/\/$/, "");
}

/**
 * Returns driving route length (meters) and typical duration (seconds), or null if routing fails.
 */
export async function fetchDrivingRouteMeters(
  from: LatLng,
  to: LatLng,
  signal?: AbortSignal,
): Promise<{ distanceMeters: number; durationSeconds: number } | null> {
  const latOk = (n: number) => Number.isFinite(n) && Math.abs(n) <= 90;
  const lngOk = (n: number) => Number.isFinite(n) && Math.abs(n) <= 180;
  if (!latOk(from.lat) || !lngOk(from.lng) || !latOk(to.lat) || !lngOk(to.lng)) return null;

  const base = osrmDrivingBaseUrl();
  const url = `${base}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false&alternatives=false`;

  try {
    const res = await fetch(url, { signal, mode: "cors" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      code?: string;
      routes?: { distance?: number; duration?: number }[];
    };
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    const r = data.routes[0];
    const distanceMeters = Number(r.distance);
    const durationSeconds = Number(r.duration);
    if (!Number.isFinite(distanceMeters) || !Number.isFinite(durationSeconds)) return null;
    return { distanceMeters, durationSeconds };
  } catch {
    return null;
  }
}
