import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MapPin, AlertTriangle, Route, MessageSquare, Navigation2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RouteDeviationMonitorProps {
  driverId: string;
  routeId?: string;
  isActive: boolean;
}

interface RouteDeviation {
  id: string;
  deviation_distance: number;
  severity: string;
  deviation_time: string;
  reason?: string;
  auto_resolved: boolean;
}

const RouteDeviationMonitor: React.FC<RouteDeviationMonitorProps> = ({ 
  driverId, 
  routeId, 
  isActive 
}) => {
  const [currentDeviation, setCurrentDeviation] = useState<number>(0);
  const [isOnRoute, setIsOnRoute] = useState(true);
  const [deviations, setDeviations] = useState<RouteDeviation[]>([]);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [deviationReason, setDeviationReason] = useState('');
  const [currentDeviationId, setCurrentDeviationId] = useState<string | null>(null);
  const [routeReference, setRouteReference] = useState<{ lat: number; lng: number } | null>(null);
  const [hasPickupCoords, setHasPickupCoords] = useState(false);
  const { toast } = useToast();

  // Route boundary baseline: centroid of driver pickup points (fallback: first live location).
  const maxDeviationDistance = 500; // meters

  useEffect(() => {
    if (!driverId) return;
    let cancelled = false;

    const loadRouteReference = async () => {
      try {
        const { data, error } = await supabase
          .from("students")
          .select("pickup_location_lat, pickup_location_lng")
          .eq("driver_id", driverId)
          .not("pickup_location_lat", "is", null)
          .not("pickup_location_lng", "is", null);
        if (error || cancelled) return;

        const pts = (data || [])
          .map((r) => ({
            lat: Number(r.pickup_location_lat),
            lng: Number(r.pickup_location_lng),
          }))
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

        if (!pts.length) {
          setHasPickupCoords(false);
          return;
        }
        setHasPickupCoords(true);
        const center = pts.reduce(
          (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
          { lat: 0, lng: 0 },
        );
        setRouteReference({
          lat: center.lat / pts.length,
          lng: center.lng / pts.length,
        });
      } catch {
        /* ignore */
      }
    };

    void loadRouteReference();
    return () => {
      cancelled = true;
    };
  }, [driverId]);

  // Monitor route adherence when tracking is active
  useEffect(() => {
    if (!isActive || !driverId) {
      return;
    }

    const watchId = navigator.geolocation?.watchPosition(
      (position) => {
        const currentLat = position.coords.latitude;
        const currentLng = position.coords.longitude;
        
        if (!routeReference) {
          // Fallback baseline: first valid GPS point after trip starts.
          setRouteReference({ lat: currentLat, lng: currentLng });
          setCurrentDeviation(0);
          return;
        }

        // Calculate distance from route reference center.
        const distance = calculateDistance(
          currentLat, 
          currentLng, 
          routeReference.lat,
          routeReference.lng
        );

        setCurrentDeviation(distance);
        
        if (distance > maxDeviationDistance) {
          if (isOnRoute) {
            handleRouteDeviation(distance, position);
            setIsOnRoute(false);
          }
        } else {
          if (!isOnRoute) {
            handleReturnToRoute();
            setIsOnRoute(true);
          }
        }
      },
      (error) => {
        console.error('Route monitoring error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isActive, driverId, isOnRoute, routeReference]);

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const handleRouteDeviation = async (distance: number, position: GeolocationPosition) => {
    let severity = 'minor';
    
    if (distance > 2000) {
      severity = 'critical';
    } else if (distance > 1000) {
      severity = 'major';
    }

    try {
      const { data, error } = await supabase
        .from('route_deviations')
        .insert({
          driver_id: driverId,
          route_id: routeId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          deviation_distance: distance,
          severity
        })
        .select()
        .single();

      if (error) throw error;
      
      setCurrentDeviationId(data.id);
      setShowReasonInput(true);

      toast({
        title: "Route Deviation Detected!",
        description: `You are ${Math.round(distance)}m off the planned route.`,
        variant: severity === 'critical' ? 'destructive' : 'default',
      });

      loadDeviations();
      
    } catch (error: any) {
      console.error('Failed to record route deviation:', error);
    }
  };

  const handleReturnToRoute = async () => {
    if (currentDeviationId) {
      try {
        const { error } = await supabase
          .from('route_deviations')
          .update({ 
            auto_resolved: true,
            resolved_time: new Date().toISOString()
          })
          .eq('id', currentDeviationId);

        if (error) throw error;

        toast({
          title: "Back on Route",
          description: "You have returned to the planned route.",
        });

        setCurrentDeviationId(null);
        setShowReasonInput(false);
        loadDeviations();
        
      } catch (error: any) {
        console.error('Failed to resolve route deviation:', error);
      }
    }
  };

  const submitDeviationReason = async () => {
    if (!currentDeviationId || !deviationReason.trim()) return;

    try {
      const { error } = await supabase
        .from('route_deviations')
        .update({ reason: deviationReason.trim() })
        .eq('id', currentDeviationId);

      if (error) throw error;

      toast({
        title: "Reason submitted",
        description: "Thank you for providing the deviation reason.",
      });

      setDeviationReason('');
      setShowReasonInput(false);
      loadDeviations();
      
    } catch (error: any) {
      console.error('Failed to submit reason:', error);
    }
  };

  const loadDeviations = async () => {
    if (!driverId) return;
    
    try {
      const { data, error } = await supabase
        .from('route_deviations')
        .select('*')
        .eq('driver_id', driverId)
        .order('deviation_time', { ascending: false })
        .limit(5);

      if (error) throw error;
      setDeviations(data || []);
    } catch (error: any) {
      console.error('Failed to load deviations:', error);
    }
  };

  useEffect(() => {
    if (driverId) {
      loadDeviations();
    }
  }, [driverId]);

  const getDeviationColor = () => {
    if (isOnRoute) return 'text-green-600';
    if (currentDeviation < 1000) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'minor': return 'bg-yellow-100 text-yellow-800';
      case 'major': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5" />
          Route Deviation Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Route Status</p>
            <div className="flex items-center gap-2">
              <Badge variant={isOnRoute ? "default" : "destructive"}>
                {isOnRoute ? "On Route" : "Off Route"}
              </Badge>
              {!isOnRoute && (
                <span className={`text-sm font-semibold ${getDeviationColor()}`}>
                  {Math.round(currentDeviation)}m deviation
                </span>
              )}
            </div>
          </div>
          <div className="text-center">
            <Navigation2 className={`h-8 w-8 ${getDeviationColor()}`} />
          </div>
        </div>

        {!isOnRoute && showReasonInput && (
          <div className="space-y-3 p-3 bg-yellow-50 rounded border border-yellow-200">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Route Deviation Detected</span>
            </div>
            <p className="text-xs text-yellow-700">
              Please provide a reason for the route deviation:
            </p>
            <div className="space-y-2">
              <Input
                placeholder="e.g., Road closure, emergency detour, traffic jam..."
                value={deviationReason}
                onChange={(e) => setDeviationReason(e.target.value)}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={submitDeviationReason}
                  disabled={!deviationReason.trim()}
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Submit Reason
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowReasonInput(false)}
                >
                  Skip
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Recent Deviations */}
        {deviations.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Recent Deviations</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {deviations.map((deviation) => (
                <div key={deviation.id} className="border rounded p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={getSeverityColor(deviation.severity)}>
                        {deviation.severity.toUpperCase()}
                      </Badge>
                      <span>{Math.round(deviation.deviation_distance)}m off route</span>
                    </div>
                    {deviation.auto_resolved && (
                      <Badge variant="outline" className="text-green-600">
                        Resolved
                      </Badge>
                    )}
                  </div>
                  {deviation.reason && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Reason: {deviation.reason}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(deviation.deviation_time).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isActive && (
          <div className="text-xs text-muted-foreground bg-yellow-50 p-2 rounded">
            ⚠️ Start a trip to enable route monitoring
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>• Route monitoring tracks adherence to planned routes</p>
          <p>• Deviations beyond 500m are flagged for review</p>
          <p>• Provide reasons for justified deviations</p>
          {!hasPickupCoords && (
            <p>• Pickup coordinates are missing, so fallback baseline GPS is used.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RouteDeviationMonitor;