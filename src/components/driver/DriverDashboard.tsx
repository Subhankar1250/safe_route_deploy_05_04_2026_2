import React, { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  LayoutGrid,
  Map,
  MapPin,
  MessageSquare,
  Navigation,
  Shield,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { MobileAppShell } from '@/components/layout/MobileAppShell';
import {
  MobileDashboardFeatureNav,
  type DashboardNavItem,
} from "@/components/layout/MobileDashboardFeatureNav";
import StudentCheckList from './StudentCheckList';
import TripTracker from './TripTracker';
import { liveTrackingService } from '@/services/liveTrackingService';
import GoogleMap from '../map/GoogleMap';
import type { DriverLocation } from "@/services/mapTypes";
import { backgroundLocationService } from '@/services/backgroundLocationService';
import { useSimpleAuth } from '@/hooks/useSimpleAuth';
import { useDriverData } from '@/hooks/useDriverData';
import GeofenceMonitor from './GeofenceMonitor';
import EmergencyPanicButton from './EmergencyPanicButton';
import SpeedMonitor from './SpeedMonitor';
import { notifyDriverGuardians } from "@/services/guardianTripNotifications";
import FloatingChatButton from '../chat/FloatingChatButton';
import { HolidayNotification } from '@/components/ui/holiday-notification';
import { SchoolServiceCalendarCard } from '@/components/ui/SchoolServiceCalendarCard';
import { DriverQuickStatus } from '@/components/driver/DriverQuickStatus';
import { DriverDelayToParents } from "@/components/driver/DriverDelayToParents";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isSecureBrowserContext, insecureContextHelpMessage } from "@/utils/browserFeatures";
import { locationPermissionHelpText } from "@/lib/nativeAndroidApp";
import { useAppLanguage } from "@/contexts/AppLanguageContext";
import { AppAiHelpAssistant } from "@/components/help/AppAiHelpAssistant";

/** Default map center (Hooghly area) when GPS is denied or unavailable */
const DEFAULT_DRIVER_MAP_CENTER = { lat: 22.783014, lng: 87.773584 };

function describeTrackingFailure(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as GeolocationPositionError).code;
    if (code === 1) {
      return `Location permission denied. ${locationPermissionHelpText()}`;
    }
    if (code === 2) {
      return "Position unavailable. Try outdoors or enable device location services.";
    }
    if (code === 3) {
      return "Location timed out. Wait for a GPS fix (map shows a pin) then start the trip again.";
    }
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: string }).message === "string" &&
    (err as { message: string }).message.trim()
  ) {
    return (err as { message: string }).message;
  }
  return "Allow location for this site and check your connection. Parents and admin will not see the bus until tracking works.";
}

const DriverDashboard: React.FC = () => {
  const [tripActive, setTripActive] = useState(false);
  const [tripStartTime, setTripStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState('00:00:00');
  const [location, setLocation] = useState<GeolocationPosition | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [driverLocations, setDriverLocations] = useState<DriverLocation[]>([]);
  const [backgroundTrackingActive, setBackgroundTrackingActive] = useState(false);
  const [journeyType, setJourneyType] = useState<'none' | 'pickup' | 'drop'>('none');
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useAppLanguage();
  const { user, logout } = useSimpleAuth();
  const { driverData, students, loading } = useDriverData(user?.id || null);

  const driverNavItems = useMemo(() => {
    let items: DashboardNavItem[] = [
      { id: "section-dash-notices", label: t("driver.nav.notices"), icon: CalendarDays },
      { id: "section-dash-quick", label: t("driver.nav.quick"), icon: MessageSquare },
      { id: "section-dash-summary", label: t("driver.nav.summary"), icon: LayoutGrid },
      { id: "section-dash-map", label: t("driver.nav.map"), icon: Map },
      { id: "section-dash-trips", label: t("driver.nav.trips"), icon: Navigation },
      { id: "section-dash-safety", label: t("driver.nav.safety"), icon: Shield },
      { id: "section-dash-students", label: t("driver.nav.students"), icon: Users },
    ];
    if (!user?.id) items = items.filter((i) => i.id !== "section-dash-quick");
    return items;
  }, [user?.id, t]);

  const [httpsBanner, setHttpsBanner] = useState(false);
  useEffect(() => {
    setHttpsBanner(!isSecureBrowserContext());
  }, []);

  const driverDataRef = useRef(driverData);
  const tripActiveRef = useRef(tripActive);
  driverDataRef.current = driverData;
  tripActiveRef.current = tripActive;

  const locationToastShown = useRef(false);

  // Watch GPS once; use refs so we don't re-subscribe (avoids toast spam / duplicate watches)
  useEffect(() => {
    if (!navigator.geolocation) return;

    let id: number | null = null;
    let cancelled = false;

    const run = async () => {
      try {
        const { ensureNativePermissions } = await import("@/services/nativePermissionsBootstrap");
        await ensureNativePermissions();
      } catch (e) {
        console.warn("ensureNativePermissions:", e);
      }
      if (cancelled) return;

      id = navigator.geolocation.watchPosition(
        (position) => {
          setLocation(position);
          const dd = driverDataRef.current;
          if (dd) {
            setDriverLocations([
              {
                driverId: dd.id,
                driverName: dd.name,
                busNumber: dd.bus_number,
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                timestamp: new Date(),
                isActive: tripActiveRef.current,
              },
            ]);
          }
        },
        (geoErr) => {
          console.warn("Geolocation:", geoErr?.message || geoErr);
          if (!locationToastShown.current) {
            locationToastShown.current = true;
            const insecure = !isSecureBrowserContext();
            toast({
              title: insecure ? "GPS needs HTTPS on phone" : "Location off",
              description: insecure ? insecureContextHelpMessage() : locationPermissionHelpText(),
              variant: "destructive",
            });
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000,
        },
      );
      setWatchId(id);
    };

    void run();

    return () => {
      cancelled = true;
      if (id != null) navigator.geolocation.clearWatch(id);
    };
  }, []);

  // Redirect if no user (only after loading is complete)
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    // Also check if user is not a driver
    if (!loading && user && user.user_type !== 'driver') {
      toast({
        title: "Access Denied",
        description: "You don't have access to the driver dashboard",
        variant: "destructive"
      });
      router.push("/login");
    }
  }, [user, loading, router]);

  // Update elapsed time when trip is active
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (tripActive && tripStartTime) {
      interval = setInterval(() => {
        const now = new Date();
        const diff = now.getTime() - tripStartTime.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        setElapsed(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [tripActive, tripStartTime]);

  const mapCenter = useMemo(
    () =>
      location
        ? { lat: location.coords.latitude, lng: location.coords.longitude }
        : DEFAULT_DRIVER_MAP_CENTER,
    [location?.coords.latitude, location?.coords.longitude],
  );

  const handleLogout = async () => {
    await logout();
    toast({
      title: "Logging out",
      description: "You have been successfully logged out.",
    });
    router.push("/login");
  };

  const handleStartTrip = async () => {
    if (!driverData) return;

    setTripActive(true);
    setTripStartTime(new Date());

    try {
      await liveTrackingService.startTracking(
        driverData.id,
        "driver",
        driverData.bus_number,
        driverData.name,
        location ? { initialFix: location } : undefined,
      );

      if (backgroundLocationService.isSupported()) {
        const hasPermissions = await backgroundLocationService.requestPermissions();
        if (hasPermissions) {
          await backgroundLocationService.startBackgroundTracking(
            driverData.name,
            "driver",
            driverData.bus_number,
            driverData.name,
          );
          setBackgroundTrackingActive(true);
        }
      }

      toast({
        title: "Legacy Trip Started",
        description: "Location is being shared with parents and the admin map.",
      });

      void notifyDriverGuardians({
        driverId: driverData.id,
        title: "Bus trip started",
        body: `${driverData.name} started the bus (Bus #${driverData.bus_number}). You can track live status in the app.`,
        step: "trip_started",
        data: { bus_number: driverData.bus_number, driver_name: driverData.name },
      });
    } catch (trackingError) {
      console.error("Failed to start auto-tracking:", trackingError);
      setTripActive(false);
      setTripStartTime(null);
      toast({
        title: "Could not share location",
        description: describeTrackingFailure(trackingError),
        variant: "destructive",
      });
    }
  };

  const handleEndTrip = async () => {
    setTripActive(false);
    setTripStartTime(null);
    setElapsed('00:00:00');
    
    // Stop live tracking
    liveTrackingService.stopTracking();
    await liveTrackingService.setInactive(driverData?.id || '');
    
    // Stop tracking location
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    
    // Stop background tracking
    if (backgroundTrackingActive) {
      await backgroundLocationService.stopBackgroundTracking();
      setBackgroundTrackingActive(false);
    }
    
    toast({
      title: "Legacy Trip Ended",
      description: "Trip completed and location tracking stopped.",
    });

    if (driverData?.id) {
      void notifyDriverGuardians({
        driverId: driverData.id,
        title: "Bus trip ended",
        body: `Bus #${driverData.bus_number ?? "—"} — tracking has stopped for this run.`,
        step: "trip_ended",
        data: { bus_number: driverData.bus_number ?? "" },
      });
    }
  };

  if (loading) {
    return (
      <MobileAppShell roleLabel={t("role.driver")} subtitle="Loading…" onLogout={handleLogout}>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading driver data…</p>
        </div>
      </MobileAppShell>
    );
  }

  if (!driverData) {
    return (
      <MobileAppShell roleLabel={t("role.driver")} subtitle="Setup required" onLogout={handleLogout}>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-base font-medium text-destructive">Driver profile not found</p>
          <Button onClick={() => router.push("/login")} className="mt-4 w-full rounded-xl sm:w-auto">
            Return to login
          </Button>
        </div>
      </MobileAppShell>
    );
  }

  return (
    <>
      <MobileAppShell
        roleLabel={t("role.driver")}
        subtitle={driverData.bus_number ? `Bus ${driverData.bus_number}` : driverData.name}
        onLogout={handleLogout}
      >
      <div className="space-y-4 sm:space-y-5">
        {httpsBanner && (
          <Alert variant="destructive" className="text-left">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>HTTPS required on this link</AlertTitle>
            <AlertDescription className="text-sm">
              {insecureContextHelpMessage()}
            </AlertDescription>
          </Alert>
        )}

        <MobileDashboardFeatureNav items={driverNavItems} title="Jump to" />

        <div className="flex justify-end">
          <AppAiHelpAssistant contextLabel="Driver" />
        </div>

        <section
          id="section-dash-notices"
          className="scroll-mt-28 space-y-4 sm:space-y-5"
          aria-label="Notices and school calendar"
        >
          <HolidayNotification />
          <SchoolServiceCalendarCard variant="todayOnly" />
        </section>

        <section id="section-dash-quick" className="scroll-mt-28" aria-label="Quick status to admin">
          {user?.id ? <DriverQuickStatus driverProfileId={user.id} /> : null}
          <DriverDelayToParents
            driverId={driverData.id}
            driverName={driverData.name}
            busNumber={driverData.bus_number}
            tripActive={tripActive}
          />
        </section>

        {/* Driver Info Cards */}
        <section
          id="section-dash-summary"
          className="scroll-mt-28"
          aria-label="Trip and route summary"
        >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{students.length}</div>
              <p className="text-sm text-muted-foreground">Assigned students</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Route
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">
                {driverData.route?.name || 'No route assigned'}
              </div>
              <p className="text-sm text-muted-foreground">Current route</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Trip Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">
                {tripActive ? 'Trip in progress' : 'Not started'}
              </div>
              <p className="text-sm text-muted-foreground">Use “Start Legacy Trip” to share your bus on the map</p>
              {backgroundTrackingActive && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-600">Background tracking active</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </section>

        <section id="section-dash-map" className="scroll-mt-28" aria-label="Map">
        <GoogleMap
          drivers={driverLocations}
          center={mapCenter}
          className="h-[min(42vh,380px)] min-h-[280px] w-full rounded-2xl border border-border/60"
          showDriverInfo={true}
        />
        </section>

        <section
          id="section-dash-trips"
          className="scroll-mt-28 space-y-4 sm:space-y-5"
          aria-label="Trips and journey"
        >
        {/* Auto-tracking info */}
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Automatic Location Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Location tracking starts automatically when you begin a legacy trip. 
              No manual intervention required.
            </p>
          </CardContent>
        </Card>

        {/* Legacy Trip Control - Keep for fallback */}
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Legacy Trip Control</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              {!tripActive ? (
                <Button onClick={handleStartTrip} className="flex-1" variant="outline">
                  <span className="hidden sm:inline">Start Legacy Trip</span>
                  <span className="sm:hidden">Start Trip</span>
                </Button>
              ) : (
                <Button onClick={handleEndTrip} variant="outline" className="flex-1">
                  <span className="hidden sm:inline">End Legacy Trip</span>
                  <span className="sm:hidden">End Trip</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Trip Tracker */}
        <TripTracker 
          isActive={tripActive}
          setIsActive={setTripActive}
          tripStartTime={tripStartTime}
          setTripStartTime={setTripStartTime}
          elapsed={elapsed}
          setElapsed={setElapsed}
          location={location}
          setLocation={setLocation}
          watchId={watchId}
          setWatchId={setWatchId}
          driverId={driverData?.id || ''}
        />

        {/* Journey Control */}
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Journey Control</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              {journeyType === 'none' ? (
                <>
                  <Button
                    onClick={() => {
                      setJourneyType("pickup");
                      if (driverData?.id) {
                        void notifyDriverGuardians({
                          driverId: driverData.id,
                          title: "Pickup run started",
                          body: `Bus #${driverData.bus_number ?? "—"} is on the pickup route. Watch for your child’s pickup alert.`,
                          step: "pickup_journey_started",
                          data: {
                            bus_number: driverData.bus_number ?? "",
                            driver_name: driverData.name ?? "",
                          },
                        });
                      }
                    }}
                    className="flex-1"
                    disabled={!tripActive}
                  >
                    <Navigation className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Start Pick Up Journey</span>
                    <span className="sm:hidden">Pick Up</span>
                  </Button>
                  <Button
                    onClick={() => {
                      setJourneyType("drop");
                      if (driverData?.id) {
                        void notifyDriverGuardians({
                          driverId: driverData.id,
                          title: "Left school for home",
                          body: `Bus #${driverData.bus_number ?? "—"} has left school and started the home drop route.`,
                          step: "drop_journey_started",
                          data: {
                            bus_number: driverData.bus_number ?? "",
                            driver_name: driverData.name ?? "",
                          },
                        });
                      }
                    }}
                    className="flex-1"
                    variant="secondary"
                    disabled={!tripActive}
                  >
                    <Navigation className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Start Drop Journey</span>
                    <span className="sm:hidden">Drop Off</span>
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => {
                    const prev = journeyType;
                    setJourneyType("none");
                    if (!driverData?.id) return;
                    if (prev === "pickup") {
                      void notifyDriverGuardians({
                        driverId: driverData.id,
                        title: "Reached school",
                        body: `Bus #${driverData.bus_number ?? "—"} has reached school.`,
                        step: "pickup_journey_ended",
                        data: { bus_number: driverData.bus_number ?? "" },
                      });
                    } else if (prev === "drop") {
                      void notifyDriverGuardians({
                        driverId: driverData.id,
                        title: "Drop-off run finished",
                        body: `Bus #${driverData.bus_number ?? "—"} has ended the drop-off leg.`,
                        step: "drop_journey_ended",
                        data: { bus_number: driverData.bus_number ?? "" },
                      });
                    }
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  End {journeyType === 'pickup' ? 'Pick Up' : 'Drop'} Journey
                </Button>
              )}
            </div>
            {!tripActive && (
              <p className="text-sm text-muted-foreground mt-2">
                Start a trip first to begin journey management
              </p>
            )}
          </CardContent>
        </Card>
        </section>

        <section
          id="section-dash-safety"
          className="scroll-mt-28 space-y-4 sm:space-y-5"
          aria-label="Safety and monitoring"
        >
        <EmergencyPanicButton
          driverId={driverData?.id || ''}
          busNumber={driverData?.bus_number}
          isActive={tripActive}
        />

        <SpeedMonitor driverId={driverData?.id || ''} isActive={tripActive} />

        <GeofenceMonitor driverId={driverData?.id || ''} isActive={tripActive} />
        </section>

        <section id="section-dash-students" className="scroll-mt-28" aria-label="Student checklist">
        <StudentCheckList isActive={tripActive} journeyType={journeyType} />
        </section>
      </div>
      </MobileAppShell>
      <FloatingChatButton />
    </>
  );
};

export default DriverDashboard;
