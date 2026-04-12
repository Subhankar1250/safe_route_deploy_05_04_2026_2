
import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Student } from './types';
import { supabase } from '@/integrations/supabase/client';
import { useSimpleAuth } from '@/hooks/useSimpleAuth';
import { todayIstDate } from '@/utils/istDate';

export const useStudentList = (isActive: boolean, journeyType: 'none' | 'pickup' | 'drop' = 'none') => {
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [driverInfo, setDriverInfo] = useState<{ busNumber?: string; driverName?: string }>({});
  const { user } = useSimpleAuth();

  const { toast } = useToast();

  useEffect(() => {
    const loadStudents = async () => {
      if (!user) return;

      try {
        setLoading(true);

        let { data: driver, error: driverError } = await supabase
          .from('drivers')
          .select('id, name, bus_number')
          .eq('profile_id', user.id)
          .single();

        if (driverError && user.mobile_number) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('mobile_number', user.mobile_number)
            .eq('user_type', 'driver')
            .single();

          if (profile && !profileError) {
            const { data: driverByProfile, error: driverByProfileError } = await supabase
              .from('drivers')
              .select('id, name, bus_number')
              .eq('profile_id', profile.id)
              .single();

            if (driverByProfile && !driverByProfileError) {
              driver = driverByProfile;
              driverError = null;
            }
          }
        }

        if (driverError || !driver) {
          console.error('Error loading driver:', driverError);
          setDriverId(null);
          setStudents([]);
          return;
        }

        setDriverId(driver.id);
        setDriverInfo({
          busNumber: driver.bus_number,
          driverName: driver.name,
        });

        const { data: studentsList, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .eq('driver_id', driver.id)
          .order('name');

        if (studentsError) {
          console.error('Error loading students:', studentsError);
          setStudents([]);
          return;
        }

        const absentSet = new Set<string>();
        try {
          const { data: absentData, error: absentError } = await supabase.functions.invoke(
            "get-driver-absent-today",
            {
              body: { driver_id: driver.id, date: todayIstDate() },
            },
          );
          if (!absentError && absentData && typeof absentData === "object") {
            const ids = (absentData as { absent_student_ids?: unknown }).absent_student_ids;
            if (Array.isArray(ids)) {
              for (const id of ids) if (typeof id === "string") absentSet.add(id);
            }
          }
        } catch {
          /* optional */
        }

        const transformedStudents: Student[] = (studentsList || []).map((student) => ({
          id: student.id,
          name: student.name,
          grade: student.grade,
          boardedAt: null,
          leftAt: null,
          isOnBoard: false,
          isAbsentToday: absentSet.has(student.id),
          pickupPoint: student.pickup_point,
          guardianName: student.guardian_name,
          guardianMobile: student.guardian_mobile,
          guardian_profile_id: student.guardian_profile_id ?? undefined,
        }));

        setStudents(transformedStudents);
      } catch (error) {
        console.error('Error loading students:', error);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, [user]);

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.grade.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const nextMapsTarget = useMemo(() => {
    if (!isActive || journeyType === "none") return null;
    const q = (s: string | undefined) => (s ?? "").trim();
    if (journeyType === "pickup") {
      const s = filteredStudents.find(
        (x) => !x.isOnBoard && !x.isAbsentToday && q(x.pickupPoint),
      );
      return s?.pickupPoint ? { studentName: s.name, query: q(s.pickupPoint) } : null;
    }
    const s = filteredStudents.find((x) => x.isOnBoard && q(x.pickupPoint));
    return s?.pickupPoint ? { studentName: s.name, query: q(s.pickupPoint) } : null;
  }, [filteredStudents, isActive, journeyType]);

  const sendNotificationToGuardian = async (student: Student, action: "pickup" | "drop") => {
    const hasMobile = Boolean((student.guardianMobile ?? "").trim());
    const hasProfile = Boolean(student.guardian_profile_id);
    if (!hasMobile && !hasProfile) {
      console.warn("Missing guardian mobile and profile id — cannot notify for", student.name);
      return;
    }

    try {
      const { sendStudentActionNotification } = await import("@/services/notificationService");

      const time = new Date().toLocaleTimeString();

      await sendStudentActionNotification({
        student_name: student.name,
        guardian_name: student.guardianName || "Parent",
        guardian_mobile: hasMobile ? student.guardianMobile : undefined,
        guardian_profile_id: student.guardian_profile_id,
        action,
        time,
        bus_number: driverInfo.busNumber || "Unknown",
        driver_name: driverInfo.driverName || "Unknown",
        pickup_point: student.pickupPoint || "Unknown",
      });

      console.log(`Notification sent to guardian for ${student.name} - ${action} at ${time}`);
    } catch (error) {
      console.error("Failed to send notification to guardian:", error);
    }
  };

  const handleCheckInOut = async (studentId: string) => {
    if (!isActive) {
      toast({
        title: 'Trip Not Active',
        description: 'Please start the trip before checking students in/out.',
        variant: 'destructive',
      });
      return;
    }

    if (!driverId) {
      toast({
        title: 'Driver not loaded',
        description: 'Wait for students to finish loading, then try again.',
        variant: 'destructive',
      });
      return;
    }

    const studentBefore = students.find((s) => s.id === studentId);
    if (!studentBefore) return;

    const willBoard = !studentBefore.isOnBoard;
    const eventType: 'pickup' | 'drop' | null =
      willBoard && journeyType === 'pickup'
        ? 'pickup'
        : !willBoard && journeyType === 'drop'
          ? 'drop'
          : null;

    let location_lat: number | undefined;
    let location_lng: number | undefined;
    if (eventType && typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          });
        });
        location_lat = position.coords.latitude;
        location_lng = position.coords.longitude;
      } catch {
        /* optional */
      }
    }

    if (eventType) {
      try {
        const { databaseIntegrationService } = await import(
          '@/services/databaseIntegrationService',
        );
        await databaseIntegrationService.logPickupDropEvent({
          student_id: studentId,
          driver_id: driverId,
          event_type: eventType,
          bus_number: driverInfo.busNumber,
          location_lat,
          location_lng,
        });
      } catch (e) {
        console.error('pickup_drop_history:', e);
        toast({
          title: 'Could not save trip history',
          description: 'The event was not saved. Guardian messages will still be sent if applicable.',
          variant: 'destructive',
        });
      }
    }

    const canNotifyGuardian =
      Boolean((studentBefore.guardianMobile ?? "").trim()) || Boolean(studentBefore.guardian_profile_id);

    if (willBoard && journeyType === "pickup" && canNotifyGuardian) {
      await sendNotificationToGuardian(studentBefore, "pickup");
    } else if (!willBoard && journeyType === "drop" && canNotifyGuardian) {
      await sendNotificationToGuardian(studentBefore, "drop");
    }

    const actionText =
      willBoard
        ? journeyType === 'pickup'
          ? 'picked up'
          : 'checked in'
        : journeyType === 'drop'
          ? 'dropped off'
          : 'checked out';

    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        if (studentBefore.isOnBoard) {
          return {
            ...s,
            isOnBoard: false,
            leftAt: new Date().toLocaleTimeString(),
          };
        }
        return {
          ...s,
          isOnBoard: true,
          boardedAt: new Date().toLocaleTimeString(),
        };
      }),
    );

    toast({
      title: willBoard
        ? journeyType === 'pickup'
          ? 'Picked Up'
          : 'Checked In'
        : journeyType === 'drop'
          ? 'Dropped Off'
          : 'Checked Out',
      description: `${studentBefore.name} has been ${actionText}.`,
    });
  };

  return {
    searchTerm,
    setSearchTerm,
    filteredStudents,
    handleCheckInOut,
    loading,
    nextMapsTarget,
  };
};
