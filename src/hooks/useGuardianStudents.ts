import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { calculateDistance, calculateEtaFromDistance } from '@/utils/locationUtils';

interface StudentWithDriver {
  student_id: string;
  student_name: string;
  grade: string;
  pickup_point: string;
  pickup_location_lat: number;
  pickup_location_lng: number;
  bus_number: string;
  driver_id: string;
  driver_name: string;
  driver_mobile: string;
  route_name: string;
}

interface DriverLocation {
  driver_id: string;
  driver_name: string;
  bus_number: string;
  latitude: number;
  longitude: number;
  last_updated: string;
  is_active: boolean;
  /** From live_locations.speed when present (km/h). */
  speed_kmh?: number;
}

const MAX_DRIVER_LOCATION_AGE_MS = 2 * 60 * 1000;

function sameBusNumber(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = (a ?? '').trim();
  const nb = (b ?? '').trim();
  return na !== '' && nb !== '' && na === nb;
}

export const useGuardianStudents = (profileId: string | null) => {
  const [students, setStudents] = useState<StudentWithDriver[]>([]);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const { toast } = useToast();
  const studentsRef = useRef<StudentWithDriver[]>([]);
  studentsRef.current = students;

  const refreshDriverLocation = useCallback(async (student: StudentWithDriver) => {
    try {
      const { data: liveLocationData, error: liveError } = await supabase
        .from('live_locations')
        .select('*')
        .eq('user_type', 'driver')
        .eq('bus_number', student.bus_number)
        .eq('is_active', true)
        .order('timestamp', { ascending: false })
        .limit(1);

      let location: DriverLocation | null = null;

      if (!liveError && liveLocationData && liveLocationData.length > 0) {
        const liveData = liveLocationData[0];
        const tsMs = Date.parse(String(liveData.timestamp ?? ""));
        const isFresh = Number.isFinite(tsMs) && Date.now() - tsMs <= MAX_DRIVER_LOCATION_AGE_MS;
        location = {
          driver_id: student.driver_id,
          driver_name: student.driver_name,
          bus_number: student.bus_number,
          latitude: liveData.latitude,
          longitude: liveData.longitude,
          last_updated: liveData.timestamp,
          // Treat stale pings as inactive to avoid fake long-distance ETA.
          is_active: Boolean(liveData.is_active) && isFresh,
          speed_kmh:
            liveData.speed != null && Number.isFinite(Number(liveData.speed))
              ? Number(liveData.speed)
              : undefined,
        };
      } else {
        const { data: locationData, error: locationError } = await supabase.rpc(
          'get_student_driver_location',
          { student_id: student.student_id },
        );

        if (!locationError && locationData && locationData.length > 0) {
          const row = locationData[0];
          if (
            row.latitude != null &&
            row.longitude != null &&
            row.is_active === true
          ) {
            const rowTs = Date.parse(String(row.last_updated ?? ""));
            const rowFresh = Number.isFinite(rowTs) && Date.now() - rowTs <= MAX_DRIVER_LOCATION_AGE_MS;
            location = {
              ...(row as DriverLocation),
              is_active: Boolean(row.is_active) && rowFresh,
            };
          }
        }
      }

      if (location) {
        setDriverLocation(location);

        if (
          student.pickup_location_lat &&
          student.pickup_location_lng &&
          location.latitude != null &&
          location.longitude != null &&
          location.is_active
        ) {
          const distance = calculateDistance(
            location.latitude,
            location.longitude,
            Number(student.pickup_location_lat),
            Number(student.pickup_location_lng),
          );

          const roadKmh =
            location.speed_kmh != null && location.speed_kmh >= 8 && location.speed_kmh <= 90
              ? location.speed_kmh
              : 28;
          const eta = calculateEtaFromDistance(distance, roadKmh);

          if (distance < 0.1) {
            setEstimatedTime('Arrived');
          } else {
            setEstimatedTime(eta.label === "—" ? null : eta.label);
          }
        } else {
          setEstimatedTime(null);
        }
      } else {
        setDriverLocation(null);
        setEstimatedTime(null);
      }
    } catch (error) {
      console.error('Error updating driver location and time:', error);
    }
  }, []);

  useEffect(() => {
    if (!profileId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadStudentData = async () => {
      try {
        setLoading(true);

        const { data: studentsData, error } = await supabase.rpc('get_guardian_with_students', {
          guardian_profile_id: profileId,
        });

        if (cancelled) return;

        if (error) {
          console.error('Error loading students:', error);
          toast({
            title: 'Error',
            description: 'Failed to load student information. Please contact admin.',
            variant: 'destructive',
          });
          return;
        }

        setStudents(studentsData || []);

        if (studentsData && studentsData.length > 0) {
          await refreshDriverLocation(studentsData[0]);
        }
      } catch (error) {
        console.error('Error loading student data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load student data',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadStudentData();

    return () => {
      cancelled = true;
    };
  }, [profileId, toast, refreshDriverLocation]);

  useEffect(() => {
    if (!profileId) return;

    const channel = supabase
      .channel(`guardian-live-locations-${profileId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_locations',
        },
        (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
          const row = (payload.new ?? payload.old) as
            | { user_type?: string; bus_number?: string }
            | undefined;
          const student = studentsRef.current[0];
          if (!student || !row || row.user_type !== 'driver') return;
          if (!sameBusNumber(row.bus_number, student.bus_number)) return;
          void refreshDriverLocation(student);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, refreshDriverLocation]);

  useEffect(() => {
    if (students.length === 0) return;
    const first = students[0];
    const tick = () => {
      const current = studentsRef.current[0];
      if (current) void refreshDriverLocation(current);
    };
    tick();
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, [students[0]?.student_id, refreshDriverLocation]);

  return {
    students,
    driverLocation,
    loading,
    estimatedTime,
  };
};
