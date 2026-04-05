import { supabase } from '@/integrations/supabase/client';
import { liveTrackingService } from './liveTrackingService';

export interface TripSession {
  id: string;
  driver_id: string;
  bus_number: string;
  start_time: string;
  end_time?: string;
  route_id?: string;
  status: "active" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
  /** Joined from `drivers` (PostgREST embed). */
  drivers?: { name: string; mobile_number?: string | null } | null;
  /** Joined from `routes` (PostgREST embed). */
  routes?: { name: string; start_point?: string | null; end_point?: string | null } | null;
}

export interface CreateTripData {
  driver_id: string;
  bus_number: string;
  route_id?: string;
  /** Shown on guardian/admin maps when set */
  driver_name?: string;
}

class TripService {
  // Start a new trip and automatically start tracking
  async startTrip(tripData: CreateTripData): Promise<TripSession> {
    const { data, error } = await supabase
      .from('trip_sessions')
      .insert([{
        driver_id: tripData.driver_id,
        bus_number: tripData.bus_number,
        route_id: tripData.route_id,
        status: 'active'
      }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    const session = data as TripSession;

    try {
      await liveTrackingService.startTracking(
        tripData.driver_id,
        'driver',
        tripData.bus_number,
        tripData.driver_name?.trim() || 'Driver',
      );
      console.log('Auto-tracking started for trip:', session.id);
    } catch (trackingError) {
      console.error('Failed to start auto-tracking:', trackingError);
      const { error: delErr } = await supabase
        .from('trip_sessions')
        .delete()
        .eq('id', session.id);
      if (delErr) {
        console.warn('Could not roll back trip session after tracking failure:', delErr.message);
      }
      throw trackingError;
    }

    return session;
  }

  // End a trip
  async endTrip(tripId: string): Promise<void> {
    const { error } = await supabase
      .from('trip_sessions')
      .update({
        status: 'completed',
        end_time: new Date().toISOString()
      })
      .eq('id', tripId);

    if (error) {
      throw error;
    }
  }

  // Get active trips
  async getActiveTrips(): Promise<TripSession[]> {
    const { data, error } = await supabase
      .from('trip_sessions')
      .select('*')
      .eq('status', 'active')
      .order('start_time', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []) as TripSession[];
  }

  // Get trip history
  async getTripHistory(limit: number = 50): Promise<TripSession[]> {
    const withFkeys = await supabase
      .from("trip_sessions")
      .select(
        `
        *,
        drivers!trip_sessions_driver_id_fkey ( name, mobile_number ),
        routes!trip_sessions_route_id_fkey ( name, start_point, end_point )
      `,
      )
      .order("start_time", { ascending: false })
      .limit(limit);

    if (!withFkeys.error) {
      return (withFkeys.data || []) as TripSession[];
    }

    // Some DBs use different FK names; infer relationships from column names.
    const inferred = await supabase
      .from("trip_sessions")
      .select(
        `
        *,
        drivers ( name, mobile_number ),
        routes ( name, start_point, end_point )
      `,
      )
      .order("start_time", { ascending: false })
      .limit(limit);

    if (inferred.error) {
      throw inferred.error;
    }

    return (inferred.data || []) as TripSession[];
  }

  // Get driver's active trip
  async getDriverActiveTrip(driverId: string): Promise<TripSession | null> {
    const { data, error } = await supabase
      .from('trip_sessions')
      .select('*')
      .eq('driver_id', driverId)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      throw error;
    }

    return data as TripSession || null;
  }
}

export const tripService = new TripService();