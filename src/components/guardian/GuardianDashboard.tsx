
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  Bus,
  CalendarDays,
  Clock,
  History,
  Map,
  MapPin,
  MessageCircle,
  Mic,
  Phone,
  Route,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSimpleAuth } from '@/hooks/useSimpleAuth';
import { useGuardianStudents } from '@/hooks/useGuardianStudents';
import { supabase } from '@/integrations/supabase/client';
import LiveTrackingMap from './LiveTrackingMap';
import PickupDropHistory from './PickupDropHistory';
import ETADisplay, { type GuardianLiveRouteEta } from "./ETADisplay";
import FloatingChatButton from '../chat/FloatingChatButton';
import { HolidayNotification } from '@/components/ui/holiday-notification';
import { SchoolServiceCalendarCard } from '@/components/ui/SchoolServiceCalendarCard';
import { FeedbackSubmissionForm } from './FeedbackSubmissionForm';
import { FeedbackHistory } from './FeedbackHistory';
import { VoiceControlPanel } from '@/components/ui/voice-controls';
import { useVoiceAnnouncements } from '@/hooks/useVoiceAnnouncements';
import { MobileAppShell } from '@/components/layout/MobileAppShell';
import {
  MobileDashboardFeatureNav,
  type DashboardNavItem,
} from "@/components/layout/MobileDashboardFeatureNav";
import { logGuardianActivity } from '@/services/userLogService';
import { registerGuardianWebPush } from '@/services/guardianPushService';
import { Capacitor } from "@capacitor/core";
import { locationPermissionHelpText } from "@/lib/nativeAndroidApp";
import { useProximityAlarm } from "@/hooks/useProximityAlarm";
import { useRoadDistanceBetween } from "@/hooks/useRoadDistanceBetween";
import { calculateDistance, calculateEtaFromDistance, formatTravelTime } from "@/utils/locationUtils";
import { markStudentAbsentToday } from "@/services/guardianAttendanceService";
import { NotificationCenter } from "@/components/guardian/NotificationCenter";
import { GuardianOnboardingChecklist } from "@/components/guardian/GuardianOnboardingChecklist";
import { useAppLanguage } from "@/contexts/AppLanguageContext";
import { trackEvent } from "@/lib/analytics";
import { AppAiHelpAssistant } from "@/components/help/AppAiHelpAssistant";

const MAX_REASONABLE_GUARDIAN_DISTANCE_KM = 100;

const GuardianDashboard: React.FC = () => {
  const [guardianLocation, setGuardianLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [correctProfileId, setCorrectProfileId] = useState<string | null>(null);
  const [absentToday, setAbsentToday] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useAppLanguage();
  const { user, logout } = useSimpleAuth();
  const { students, driverLocation, loading, estimatedTime } = useGuardianStudents(correctProfileId || user?.id || null);
  const { announceBusArrival } = useVoiceAnnouncements();
  const lastAnnouncedEtaRef = useRef<string | null>(null);
  const dashboardViewTrackedRef = useRef(false);
  const mapViewTrackedRef = useRef(false);

  const student = students[0];

  const guardianDriverRoadEnabled =
    !!student &&
    !!guardianLocation &&
    !!driverLocation?.is_active &&
    Number.isFinite(driverLocation.latitude) &&
    Number.isFinite(driverLocation.longitude);

  const guardianRoad = useRoadDistanceBetween(
    guardianLocation ? { lat: guardianLocation.latitude, lng: guardianLocation.longitude } : null,
    driverLocation && guardianDriverRoadEnabled
      ? { lat: driverLocation.latitude, lng: driverLocation.longitude }
      : null,
    { enabled: guardianDriverRoadEnabled, debounceMs: 1400 },
  );

  const guardianLiveRouteEta = useMemo((): GuardianLiveRouteEta | null => {
    if (!driverLocation || !guardianLocation || driverLocation.is_active === false) return null;
    const tsMs = Date.parse(driverLocation.last_updated ?? "");
    const fresh =
      !driverLocation.last_updated ||
      (Number.isFinite(tsMs) && Date.now() - tsMs <= 2 * 60 * 1000);
    if (!fresh) return null;

    const straightKm = calculateDistance(
      driverLocation.latitude,
      driverLocation.longitude,
      guardianLocation.latitude,
      guardianLocation.longitude,
    );
    if (!Number.isFinite(straightKm) || straightKm > MAX_REASONABLE_GUARDIAN_DISTANCE_KM) return null;

    const speed = driverLocation.speed_kmh ?? 28;
    const straightEta = calculateEtaFromDistance(straightKm, speed);

    if (!guardianRoad.hasFirstEstimate) {
      return {
        pending: true,
        distanceKm: straightEta.distanceKm,
        durationMinutes: straightEta.durationMinutes,
        estimatedArrivalTime: straightEta.label,
        followsRoadNetwork: false,
      };
    }

    const km = (guardianRoad.distanceMeters ?? 0) / 1000;
    if (!Number.isFinite(km) || km > MAX_REASONABLE_GUARDIAN_DISTANCE_KM) return null;

    if (km < 0.1) {
      return {
        pending: false,
        distanceKm: km,
        durationMinutes: 0,
        estimatedArrivalTime: "Arrived",
        followsRoadNetwork: guardianRoad.isRoad,
      };
    }

    if (guardianRoad.isRoad && guardianRoad.durationSeconds != null) {
      const minutes = Math.max(1, Math.round(guardianRoad.durationSeconds / 60));
      return {
        pending: guardianRoad.loading,
        distanceKm: km,
        durationMinutes: minutes,
        estimatedArrivalTime: formatTravelTime(minutes),
        followsRoadNetwork: true,
      };
    }

    const eta = calculateEtaFromDistance(km, speed);
    return {
      pending: guardianRoad.loading,
      distanceKm: eta.distanceKm,
      durationMinutes: eta.durationMinutes,
      estimatedArrivalTime: eta.label,
      followsRoadNetwork: false,
    };
  }, [driverLocation, guardianLocation, guardianRoad]);

  // 500m / 200m / 100m alarms (Haversine crossings); road meters only for displayed hook distance when ready
  useProximityAlarm({
    enabled: guardianDriverRoadEnabled,
    guardianLocation,
    driverLocation: driverLocation
      ? { latitude: driverLocation.latitude, longitude: driverLocation.longitude }
      : null,
    drivingDistance: guardianDriverRoadEnabled
      ? {
          meters: guardianRoad.distanceMeters ?? 0,
          ready: Boolean(guardianRoad.hasFirstEstimate && guardianRoad.distanceMeters != null),
        }
      : undefined,
    onTriggered: ({ band }) => {
      const descKey =
        band === 500
          ? "guardian.proximityMsg500"
          : band === 200
            ? "guardian.proximityMsg200"
            : "guardian.proximityMsg100";
      toast({
        title: t("guardian.proximityTitle"),
        description: t(descKey),
      });
    },
  });

  const guardianProfileId = correctProfileId || user?.id || null;

  useEffect(() => {
    if (loading || dashboardViewTrackedRef.current) return;
    if (!user || user.user_type !== "guardian") return;
    dashboardViewTrackedRef.current = true;
    trackEvent("guardian_dashboard_view", { has_student: Boolean(student) });
  }, [loading, user, student]);

  useEffect(() => {
    if (loading || !student) return;
    const node = document.getElementById("section-g-map");
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !mapViewTrackedRef.current) {
            mapViewTrackedRef.current = true;
            trackEvent("guardian_map_view");
          }
        }
      },
      { threshold: 0.12 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [loading, student?.student_id]);

  const toggleAbsent = async () => {
    if (!guardianProfileId || !student?.student_id) return;
    const next = !absentToday;
    const res = await markStudentAbsentToday({
      guardianProfileId,
      guardianMobile: user?.mobile_number,
      studentId: student.student_id,
      absent: next,
    });
    if (!res.ok) {
      toast({
        title: t("guardian.absentFailTitle"),
        description: res.message ?? t("guardian.absentTryAgain"),
        variant: "destructive",
      });
      return;
    }
    setAbsentToday(next);
    toast({
      title: next ? t("guardian.markedAbsent") : t("guardian.markedPresent"),
      description: next
        ? t("guardian.driverWillSeeAbsent")
        : t("guardian.driverWillSeePresent"),
    });
  };

  // Guardian voice announcement: announce meaningful ETA changes only once per value.
  useEffect(() => {
    if (!driverLocation?.is_active) return;
    if (!estimatedTime) return;
    if (!student?.bus_number) return;
    if (lastAnnouncedEtaRef.current === estimatedTime) return;

    const shouldAnnounce =
      estimatedTime === "Arrived" ||
      estimatedTime === "Less than 1 min" ||
      /(^[0-9]+\s*mins?$)|(^[0-9]+\s*min$)|(^[0-9]+\s*hr)/i.test(estimatedTime);
    if (!shouldAnnounce) return;

    lastAnnouncedEtaRef.current = estimatedTime;
    void announceBusArrival(student.bus_number, estimatedTime);
  }, [announceBusArrival, driverLocation?.is_active, estimatedTime, student?.bus_number]);

  const guardianNavItems = useMemo(() => {
    const full: DashboardNavItem[] = [
      { id: "section-g-notices", label: t("guardian.nav.notices"), icon: CalendarDays },
      { id: "section-g-child", label: t("guardian.nav.child"), icon: User },
      { id: "section-g-driver", label: t("guardian.nav.driver"), icon: Bus },
      { id: "section-g-live", label: t("guardian.nav.live"), icon: Activity },
      { id: "section-g-eta", label: t("guardian.nav.eta"), icon: Clock },
      { id: "section-g-map", label: t("guardian.nav.map"), icon: Map },
      { id: "section-g-history", label: t("guardian.nav.history"), icon: History },
      { id: "section-g-feedback", label: t("guardian.nav.feedback"), icon: MessageCircle },
      { id: "section-g-voice", label: t("guardian.nav.voice"), icon: Mic },
      { id: "section-g-location", label: t("guardian.nav.location"), icon: MapPin },
    ];
    const minimal: DashboardNavItem[] = [
      { id: "section-g-notices", label: t("guardian.nav.notices"), icon: CalendarDays },
    ];

    if (!student) return minimal;
    let items = [...full];
    if (!student.driver_name) {
      items = items.filter((i) => i.id !== "section-g-driver");
    }
    if (!driverLocation) {
      items = items.filter((i) => i.id !== "section-g-live");
    }
    if (!guardianLocation) {
      items = items.filter((i) => i.id !== "section-g-location");
    }
    return items;
  }, [student, student?.driver_name, driverLocation, guardianLocation, t]);

  // Fix profile ID issue on mount
  useEffect(() => {
    const fixProfileId = async () => {
      if (user && user.mobile_number) {
        try {
          // Get the correct profile ID based on mobile number
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('mobile_number', user.mobile_number)
            .eq('user_type', 'guardian')
            .single();
          
          if (profile && profile.id !== user.id) {
            console.log('Correcting profile ID from', user.id, 'to', profile.id);
            setCorrectProfileId(profile.id);
            
            // Update localStorage with correct profile ID
            const updatedUser = { ...user, id: profile.id };
            localStorage.setItem('sishu_tirtha_user', JSON.stringify(updatedUser));
          } else if (profile) {
            setCorrectProfileId(profile.id);
          }
        } catch (error) {
          console.error('Error fixing profile ID:', error);
        }
      }
    };
    
    if (user) {
      fixProfileId();
    }
  }, [user]);

  // Push registration + activity logging (session stays valid until manual logout — no midnight expiry)
  useEffect(() => {
    const pid = correctProfileId || user?.id;
    const name = user?.username || "Guardian";
    if (!user || user.user_type !== "guardian" || !pid) return;

    void logGuardianActivity({
      user_id: pid,
      user_name: name,
      activity_type: "app_open",
    });

    void registerGuardianWebPush(pid).then((ok) => {
      if (ok) {
        void logGuardianActivity({
          user_id: pid,
          user_name: name,
          activity_type: "push_register",
        });
      }
    });

    const PING_MS = 15 * 60 * 1000;
    const pingSession = () => {
      const last = parseInt(localStorage.getItem("sishu_guardian_last_session_ping") || "0", 10);
      if (Date.now() - last < PING_MS) return;
      localStorage.setItem("sishu_guardian_last_session_ping", String(Date.now()));
      void logGuardianActivity({
        user_id: pid,
        user_name: name,
        activity_type: "session_active",
      });
    };
    pingSession();
    const onVis = () => {
      if (document.visibilityState === "visible") pingSession();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [user, correctProfileId, user?.username, user?.id]);

  // Get the guardian's current location (Capacitor: request OS permission before WebView geolocation)
  useEffect(() => {
    let watchId: number | null = null;
    let cancelled = false;

    const run = async () => {
      try {
        const { ensureNativePermissions } = await import("@/services/nativePermissionsBootstrap");
        await ensureNativePermissions();
      } catch (e) {
        console.warn("ensureNativePermissions:", e);
      }
      if (cancelled) return;
      if (!navigator.geolocation) {
        setLocationError("Geolocation is not supported by this browser.");
        return;
      }
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          setGuardianLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLocationError(null);
        },
        (error) => {
          console.error("Error getting location:", error);
          const denied =
            error && typeof error === "object" && "code" in error && (error as GeolocationPositionError).code === 1;
          if (denied) {
            setLocationError(locationPermissionHelpText());
          } else {
            setLocationError(
              Capacitor.isNativePlatform()
                ? "Unable to get a GPS fix. Try moving outdoors or check that device location is on."
                : "Unable to access your location. Please enable location services.",
            );
          }
        },
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 },
      );
    };

    void run();

    return () => {
      cancelled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Redirect if no user (only after loading is complete)
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    // Also check if user is not a guardian
    if (!loading && user && user.user_type !== 'guardian') {
      toast({
        title: "Access Denied",
        description: "You don't have access to the guardian dashboard",
        variant: "destructive"
      });
      router.push("/login");
    }
  }, [user, loading, router, toast]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (loading) {
    return (
      <MobileAppShell roleLabel="Guardian" subtitle="Loading…" onLogout={handleLogout}>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-center text-sm text-muted-foreground">Loading student information…</p>
        </div>
      </MobileAppShell>
    );
  }

  return (
    <>
      <MobileAppShell
        roleLabel={t("role.guardian")}
        subtitle={student ? student.student_name : t("role.guardianSubtitle")}
        onLogout={handleLogout}
      >
        <MobileDashboardFeatureNav items={guardianNavItems} title="Jump to" />

        <div className="flex justify-end">
          <AppAiHelpAssistant contextLabel="Guardian" />
        </div>

        {student ? <GuardianOnboardingChecklist hasLocation={!!guardianLocation} /> : null}

        <section
          id="section-g-notices"
          className="scroll-mt-28 space-y-4 sm:space-y-5"
          aria-label="Notices and school calendar"
        >
          <HolidayNotification />
          <SchoolServiceCalendarCard variant="todayOnly" />
          <NotificationCenter profileId={guardianProfileId} />
        </section>

        {student ? (
          <div className="space-y-4 sm:space-y-5">
            {/* Student Information Card */}
            <section id="section-g-child" className="scroll-mt-28" aria-label="Child information">
            <Card className="rounded-2xl border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl flex items-center">
                  <User className="mr-2 h-5 w-5" /> {student.student_name} - Grade {student.grade}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Pickup Point</p>
                    <p className="font-medium">{student.pickup_point}</p>
                  </div>
                   <div>
                     <p className="text-sm text-muted-foreground">Bus Number</p>
                     <p className="font-medium text-blue-600 flex items-center">
                       <Bus className="mr-1 h-4 w-4" />
                       {student.bus_number}
                     </p>
                   </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={absentToday ? "secondary" : "destructive"}
                    onClick={() => void toggleAbsent()}
                  >
                    {absentToday ? t("guardian.undoAbsent") : t("guardian.markAbsent")}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {t("guardian.absentHint")}
                  </p>
                </div>
              </CardContent>
            </Card>
            </section>

            {/* Driver Information Card */}
            {student.driver_name && (
              <section id="section-g-driver" className="scroll-mt-28" aria-label="Driver details">
              <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <User className="mr-2 h-5 w-5" /> Driver Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center">
                        <User className="mr-1 h-3 w-3" /> Driver Name
                      </p>
                      <p className="font-medium">{student.driver_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center">
                        <Phone className="mr-1 h-3 w-3" /> Mobile Number
                      </p>
                      <p className="font-medium">{student.driver_mobile || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center">
                        <Bus className="mr-1 h-3 w-3" /> Bus Number
                      </p>
                      <p className="font-medium">{student.bus_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center">
                        <Route className="mr-1 h-3 w-3" /> Route
                      </p>
                      <p className="font-medium">{student.route_name || 'N/A'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </section>
            )}

            {/* Live Tracking Status with Enhanced Arrival Time */}
            {driverLocation && (
              <section id="section-g-live" className="scroll-mt-28" aria-label="Live bus tracking">
              <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <MapPin className="mr-2 h-5 w-5" /> Live Bus Tracking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          driverLocation.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {driverLocation.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {driverLocation.last_updated && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Last Updated</span>
                          <span className="text-sm">{new Date(driverLocation.last_updated).toLocaleTimeString()}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Enhanced Arrival Time Display */}
                    {estimatedTime && driverLocation && driverLocation.is_active && (
                      <div className={`p-4 rounded-lg border ${
                        estimatedTime === 'Arrived' 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className={`h-5 w-5 ${
                              estimatedTime === 'Arrived' ? 'text-green-600' : 'text-blue-600'
                            }`} />
                            <span className={`font-medium ${
                              estimatedTime === 'Arrived' ? 'text-green-900' : 'text-blue-900'
                            }`}>
                              {estimatedTime === 'Arrived' ? 'Bus Status' : 'Estimated Arrival Time'}
                            </span>
                          </div>
                          <span className={`text-lg font-bold ${
                            estimatedTime === 'Arrived' ? 'text-green-600' : 'text-blue-600'
                          }`}>
                            {estimatedTime === 'Arrived' ? 'Arrived!' : estimatedTime}
                          </span>
                        </div>
                        <div className={`mt-2 text-sm ${
                          estimatedTime === 'Arrived' ? 'text-green-700' : 'text-blue-700'
                        }`}>
                          {estimatedTime === 'Arrived' 
                            ? 'The bus is at or near your pickup point.'
                            : 'Estimated time for the bus to reach your pickup point.'
                          }
                        </div>
                      </div>
                    )}

                    {/* Generic ETA warning */}
                    {driverLocation && driverLocation.is_active && !estimatedTime && (
                      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                        <div className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-orange-600" />
                          <span className="font-medium text-orange-900">Cannot Calculate Arrival Time</span>
                        </div>
                        <div className="mt-1 text-sm text-orange-700">
                          Waiting for stable live location from your phone and the driver phone.
                        </div>
                      </div>
                    )}
                    
                    {/* No active tracking message */}
                    {driverLocation && !driverLocation.is_active && (
                      <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                        <div className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-amber-600" />
                          <span className="font-medium text-amber-900">Tracking Inactive</span>
                        </div>
                        <div className="mt-1 text-sm text-amber-700">
                          The bus is not currently sharing live location. Please check back later.
                        </div>
                      </div>
                    )}

                    {/* No driver location at all */}
                    {!driverLocation && (
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-gray-600" />
                          <span className="font-medium text-gray-900">No Location Data</span>
                        </div>
                        <div className="mt-1 text-sm text-gray-700">
                          No driver location information is available at this time.
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              </section>
            )}

            {/* Enhanced ETA Display */}
            <section id="section-g-eta" className="scroll-mt-28" aria-label="Estimated arrival">
            <ETADisplay 
              studentIds={[student.student_id]} 
              studentName={student.student_name}
              busNumber={student.bus_number}
              driverLocation={driverLocation ? {
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
                speed_kmh: driverLocation.speed_kmh,
                is_active: driverLocation.is_active,
                last_updated: driverLocation.last_updated,
              } : null}
              guardianLocation={guardianLocation}
              guardianLiveRouteEta={guardianLiveRouteEta}
            />
            </section>

            {/* Live Tracking Map */}
            <section id="section-g-map" className="scroll-mt-28" aria-label="Live map">
            <LiveTrackingMap studentBusNumber={student.bus_number} guardianLocation={guardianLocation} />
            </section>

            {/* Pickup & Drop History */}
            <section id="section-g-history" className="scroll-mt-28" aria-label="Pickup and drop history">
            <PickupDropHistory guardianProfileId={correctProfileId || user?.id || null} />
            </section>

            {/* Feedback Submission Form */}
            <section id="section-g-feedback" className="scroll-mt-28 space-y-4" aria-label="Feedback">
            <FeedbackSubmissionForm 
              guardianProfileId={correctProfileId || user?.id || ''}
              students={[{
                student_id: student.student_id,
                student_name: student.student_name,
                driver_id: student.driver_id,
                driver_name: student.driver_name,
                bus_number: student.bus_number
              }]}
              onFeedbackSubmitted={() => {
                toast({
                  title: "Feedback Submitted",
                  description: "Thank you for your feedback!",
                });
              }}
            />

            {/* Feedback History */}
            <FeedbackHistory guardianProfileId={correctProfileId || user?.id || ''} />
            </section>

            {/* Voice Control Panel */}
            <section id="section-g-voice" className="scroll-mt-28" aria-label="Voice announcements">
            <VoiceControlPanel />
            </section>

            {/* Guardian Location Card */}
            {guardianLocation && (
              <section id="section-g-location" className="scroll-mt-28" aria-label="Your location">
              <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Your Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {locationError ? (
                      <p className="text-sm text-destructive">{locationError}</p>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        <p>Latitude: {guardianLocation.latitude.toFixed(6)}</p>
                        <p>Longitude: {guardianLocation.longitude.toFixed(6)}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              </section>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2 text-center sm:space-y-5">
            <Card className="rounded-2xl border-border/60 shadow-sm">
              <CardContent className="pt-6">
                <p className="text-muted-foreground">No student information found for your account.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Please contact the school administrator if this seems incorrect.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </MobileAppShell>
      <FloatingChatButton />
    </>
  );
};

export default GuardianDashboard;
