import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Bus, RefreshCw, Navigation } from "lucide-react";
import { etaCalculationService, ETACalculation } from '@/services/etaCalculationService';
import { useToast } from '@/hooks/use-toast';

interface ETADisplayProps {
  studentIds: string[];
  studentName?: string;
  busNumber?: string;
}

const ETADisplay: React.FC<ETADisplayProps> = ({ studentIds, studentName, busNumber }) => {
  const [etas, setEtas] = useState<Map<string, ETACalculation>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const { toast } = useToast();

  const studentIdsKey = useMemo(() => studentIds.slice().sort().join("|"), [studentIds]);
  const stableStudentIds = useMemo(() => [...studentIds], [studentIdsKey]);

  const handleETAUpdate = useCallback((newEtas: Map<string, ETACalculation>) => {
    setEtas(newEtas);
    setLastUpdated(new Date());
    setIsLoading(false);
  }, []);

  const refreshETA = async () => {
    setIsLoading(true);
    try {
      etaCalculationService.clearCache();
      const newEtas = await etaCalculationService.calculateETAForStudents([...studentIds]);
      handleETAUpdate(newEtas);
    } catch (error) {
      console.error("Error refreshing ETA:", error);
      toast({
        title: "ETA Update Failed",
        description: "Could not refresh arrival time estimates",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!autoUpdate || stableStudentIds.length === 0) return;
    etaCalculationService.clearCache();
    etaCalculationService.startETAUpdates(stableStudentIds, handleETAUpdate);
    return () => etaCalculationService.stopETAUpdates();
  }, [autoUpdate, studentIdsKey, handleETAUpdate, stableStudentIds]);

  // Get primary ETA (for single student or first student)
  const primaryETA =
    stableStudentIds.length > 0 ? etas.get(stableStudentIds[0]) : null;

  const getETAColor = (eta: ETACalculation) => {
    if (eta.estimatedArrivalTime === 'Arrived') return 'default';
    if (eta.durationMinutes <= 5) return 'destructive';
    if (eta.durationMinutes <= 15) return 'secondary';
    return 'outline';
  };

  const getETAIcon = (eta: ETACalculation) => {
    if (eta.estimatedArrivalTime === 'Arrived') return <MapPin className="h-4 w-4" />;
    if (eta.durationMinutes <= 5) return <Navigation className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  const formatDistance = (distance: number) => {
    if (distance < 1) return `${Math.round(distance * 1000)}m away`;
    return `${distance.toFixed(1)}km away`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bus className="h-5 w-5" />
            Live Bus ETA
            {busNumber && <Badge variant="secondary">Bus #{busNumber}</Badge>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshETA}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {stableStudentIds.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Bus className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No students assigned for ETA calculation</p>
          </div>
        ) : primaryETA ? (
          <>
            {/* Primary ETA Display */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                {getETAIcon(primaryETA)}
                <span className="text-sm text-muted-foreground">
                  {studentName || 'Your child\'s bus'}
                </span>
              </div>
              
              <div className={`text-3xl font-bold mb-2 ${
                primaryETA.estimatedArrivalTime === 'Arrived' 
                  ? 'text-green-600' 
                  : primaryETA.durationMinutes <= 5 
                    ? 'text-red-600' 
                    : 'text-primary'
              }`}>
                {primaryETA.estimatedArrivalTime}
              </div>

              <Badge variant={getETAColor(primaryETA)} className="mb-3">
                {primaryETA.estimatedArrivalTime === 'Arrived' 
                  ? 'Bus has arrived!' 
                  : 'Estimated arrival'}
              </Badge>

              {/* Distance Information */}
              <div className="text-sm text-muted-foreground">
                {formatDistance(primaryETA.distanceKm)}
              </div>
            </div>

            {/* Additional Information */}
            <div className="grid grid-cols-2 gap-4 pt-3 border-t">
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {primaryETA.distanceKm.toFixed(1)}km
                </div>
                <div className="text-sm text-muted-foreground">Distance</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {primaryETA.estimatedArrivalTime === 'Arrived' ? '0' : primaryETA.durationMinutes}min
                </div>
                <div className="text-sm text-muted-foreground">Travel Time</div>
              </div>
            </div>

            {/* Status Messages */}
            {primaryETA.estimatedArrivalTime === 'Arrived' && (
              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 text-green-800">
                  <MapPin className="h-4 w-4" />
                  <span className="font-medium">Bus has arrived at pickup point!</span>
                </div>
                <div className="text-sm text-green-700 mt-1">
                  Please be ready for pickup.
                </div>
              </div>
            )}

            {primaryETA.estimatedArrivalTime !== 'Arrived' && primaryETA.durationMinutes <= 5 && (
              <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 text-red-800">
                  <Navigation className="h-4 w-4" />
                  <span className="font-medium">Bus approaching soon!</span>
                </div>
                <div className="text-sm text-red-700 mt-1">
                  Please get ready at the pickup point.
                </div>
              </div>
            )}

            {/* Multiple Students (if applicable) */}
            {stableStudentIds.length > 1 && (
              <div className="pt-3 border-t">
                <div className="text-sm font-medium mb-2">Other Children:</div>
                <div className="space-y-2">
                  {stableStudentIds.slice(1).map(studentId => {
                    const eta = etas.get(studentId);
                    if (!eta) return null;
                    
                    return (
                      <div key={studentId} className="flex items-center justify-between text-sm">
                        <span>Student {studentId.slice(-6)}</span>
                        <Badge variant={getETAColor(eta)}>
                          {eta.estimatedArrivalTime}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            {isLoading ? (
              <>
                <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Calculating arrival time...</p>
              </>
            ) : (
              <>
                <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">ETA information not available</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Bus location or pickup coordinates may be missing
                </p>
              </>
            )}
          </div>
        )}

        {/* Last Updated */}
        {lastUpdated && (
          <div className="pt-2 border-t text-xs text-muted-foreground text-center">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}

        {/* Auto-update Toggle */}
        <div className="flex items-center justify-center gap-2 pt-2">
          <input
            type="checkbox"
            id="auto-update"
            checked={autoUpdate}
            onChange={(e) => setAutoUpdate(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="auto-update" className="text-sm text-muted-foreground">
            Auto-update every 15 seconds
          </label>
        </div>
      </CardContent>
    </Card>
  );
};

export default ETADisplay;