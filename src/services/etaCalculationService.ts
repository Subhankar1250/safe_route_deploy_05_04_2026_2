import { supabase } from "@/integrations/supabase/client";
import { calculateDistance, calculateEtaFromDistance } from "@/utils/locationUtils";

interface ETACalculation {
  studentId: string;
  estimatedArrivalTime: string;
  distanceKm: number;
  durationMinutes: number;
  lastUpdated: Date;
}

interface BusLocation {
  latitude: number;
  longitude: number;
  timestamp: string;
  speedKmh?: number;
  heading?: number;
}

interface PickupLocation {
  latitude: number;
  longitude: number;
  address: string;
}

/** Typical school-bus average when GPS speed is missing or unreliable (km/h). */
const DEFAULT_ROAD_SPEED_KMH = 28;
const MAX_DRIVER_LOCATION_AGE_MS = 2 * 60 * 1000;

class ETACalculationService {
  private static instance: ETACalculationService;
  private cachedETAs: Map<string, ETACalculation> = new Map();
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private readonly CACHE_DURATION = 20000;

  private constructor() {}

  static getInstance(): ETACalculationService {
    if (!ETACalculationService.instance) {
      ETACalculationService.instance = new ETACalculationService();
    }
    return ETACalculationService.instance;
  }

  private effectiveSpeedKmh(gpsSpeed?: number | null): number {
    if (gpsSpeed != null && Number.isFinite(gpsSpeed) && gpsSpeed >= 8 && gpsSpeed <= 90) {
      return gpsSpeed;
    }
    return DEFAULT_ROAD_SPEED_KMH;
  }

  private async getStudentBusNumber(studentId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("students")
      .select("bus_number")
      .eq("id", studentId)
      .maybeSingle();
    if (error || !data?.bus_number) return null;
    const b = String(data.bus_number).trim();
    return b || null;
  }

  /**
   * Prefer RPC (matches driver profile_id or drivers.id). If coords missing, match live_locations by bus
   * (same path as guardian hook) so ETA stays in sync with the map.
   */
  private async getBusLocationForStudent(studentId: string): Promise<BusLocation | null> {
    try {
      const { data: rpcRows, error: rpcError } = await supabase.rpc("get_student_driver_location", {
        student_id: studentId,
      });

      if (!rpcError && rpcRows?.length) {
        const row = rpcRows[0] as {
          latitude?: number | null;
          longitude?: number | null;
          is_active?: boolean | null;
          last_updated?: string | null;
        };
        const lat = row.latitude != null ? Number(row.latitude) : NaN;
        const lng = row.longitude != null ? Number(row.longitude) : NaN;
        if (row.is_active === true && Number.isFinite(lat) && Number.isFinite(lng)) {
          const tsMs = Date.parse(String(row.last_updated ?? ""));
          const isFresh = Number.isFinite(tsMs) && Date.now() - tsMs <= MAX_DRIVER_LOCATION_AGE_MS;
          if (!isFresh) return null;
          return {
            latitude: lat,
            longitude: lng,
            timestamp: row.last_updated ?? new Date().toISOString(),
          };
        }
      }

      const bus = await this.getStudentBusNumber(studentId);
      if (!bus) return null;

      const { data: liveRows, error: liveError } = await supabase
        .from("live_locations")
        .select("latitude, longitude, timestamp, speed, is_active")
        .eq("user_type", "driver")
        .eq("bus_number", bus)
        .eq("is_active", true)
        .order("timestamp", { ascending: false })
        .limit(1);

      if (liveError || !liveRows?.length) return null;
      const live = liveRows[0];
      const lat = Number(live.latitude);
      const lng = Number(live.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const liveTsMs = Date.parse(String(live.timestamp ?? ""));
      const liveFresh = Number.isFinite(liveTsMs) && Date.now() - liveTsMs <= MAX_DRIVER_LOCATION_AGE_MS;
      if (!liveFresh) return null;

      return {
        latitude: lat,
        longitude: lng,
        timestamp: live.timestamp,
        speedKmh: live.speed != null ? Number(live.speed) : undefined,
      };
    } catch (e) {
      console.error("getBusLocationForStudent:", e);
      return null;
    }
  }

  private async getPickupLocation(studentId: string): Promise<PickupLocation | null> {
    try {
      const { data: student, error } = await supabase
        .from("students")
        .select("pickup_location_lat, pickup_location_lng, pickup_point")
        .eq("id", studentId)
        .single();

      if (error) throw error;
      const lat = Number(student?.pickup_location_lat);
      const lng = Number(student?.pickup_location_lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      return {
        latitude: lat,
        longitude: lng,
        address: student.pickup_point ?? "",
      };
    } catch (e) {
      console.error("getPickupLocation:", e);
      return null;
    }
  }

  async calculateETAForStudent(studentId: string): Promise<ETACalculation | null> {
    try {
      const cached = this.cachedETAs.get(studentId);
      if (cached && Date.now() - cached.lastUpdated.getTime() < this.CACHE_DURATION) {
        return cached;
      }

      const [busLocation, pickupLocation] = await Promise.all([
        this.getBusLocationForStudent(studentId),
        this.getPickupLocation(studentId),
      ]);

      if (!busLocation || !pickupLocation) return null;

      const distance = calculateDistance(
        busLocation.latitude,
        busLocation.longitude,
        pickupLocation.latitude,
        pickupLocation.longitude,
      );

      if (!Number.isFinite(distance)) return null;

      const speed = this.effectiveSpeedKmh(busLocation.speedKmh);
      const etaCalc = calculateEtaFromDistance(distance, speed);

      const eta: ETACalculation = {
        studentId,
        estimatedArrivalTime: etaCalc.label,
        distanceKm: etaCalc.distanceKm,
        durationMinutes: etaCalc.label === "Arrived" ? 0 : Math.max(1, etaCalc.durationMinutes),
        lastUpdated: new Date(),
      };

      this.cachedETAs.set(studentId, eta);
      return eta;
    } catch (e) {
      console.error("calculateETAForStudent:", e);
      return null;
    }
  }

  async calculateETAForStudents(studentIds: string[]): Promise<Map<string, ETACalculation>> {
    const results = new Map<string, ETACalculation>();
    const settled = await Promise.allSettled(studentIds.map((id) => this.calculateETAForStudent(id)));
    settled.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value) {
        results.set(studentIds[index], result.value);
      }
    });
    return results;
  }

  startETAUpdates(studentIds: string[], onUpdate: (etas: Map<string, ETACalculation>) => void): void {
    this.stopETAUpdates();

    const tick = async () => {
      const etas = await this.calculateETAForStudents(studentIds);
      onUpdate(etas);
    };

    this.updateInterval = setInterval(() => {
      void tick();
    }, 15000);

    void tick();
  }

  stopETAUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  async getEnhancedETA(studentId: string): Promise<{
    eta: ETACalculation | null;
    busStatus: "approaching" | "arrived" | "departed" | "inactive";
    nextStop?: string;
  }> {
    const eta = await this.calculateETAForStudent(studentId);

    let busStatus: "approaching" | "arrived" | "departed" | "inactive" = "inactive";

    if (eta) {
      if (eta.estimatedArrivalTime === "Arrived") {
        busStatus = "arrived";
      } else if (eta.durationMinutes <= 5) {
        busStatus = "approaching";
      } else {
        busStatus = "approaching";
      }
    }

    return {
      eta,
      busStatus,
      nextStop: eta ? "Your pickup point" : undefined,
    };
  }

  clearCache(studentId?: string): void {
    if (studentId) {
      this.cachedETAs.delete(studentId);
    } else {
      this.cachedETAs.clear();
    }
  }

  getCacheStats(): {
    totalCached: number;
    avgAge: number;
    oldestEntry: number;
  } {
    const now = Date.now();
    const entries = Array.from(this.cachedETAs.values());

    if (entries.length === 0) {
      return { totalCached: 0, avgAge: 0, oldestEntry: 0 };
    }

    const ages = entries.map((e) => now - e.lastUpdated.getTime());
    const avgAge = ages.reduce((s, a) => s + a, 0) / ages.length;
    const oldestEntry = Math.max(...ages);

    return {
      totalCached: entries.length,
      avgAge: Math.round(avgAge / 1000),
      oldestEntry: Math.round(oldestEntry / 1000),
    };
  }
}

export const etaCalculationService = ETACalculationService.getInstance();
export type { ETACalculation, BusLocation, PickupLocation };
