
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Navigation } from 'lucide-react';
import { useLiveTracking } from '@/hooks/useLiveTracking';
import LiveBusLocation from './LiveBusLocation';

interface LiveTrackingMapProps {
  studentBusNumber: string;
  guardianLocation?: { latitude: number; longitude: number } | null;
}

const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({ studentBusNumber, guardianLocation }) => {
  const { locations } = useLiveTracking();
  const [busLocation, setBusLocation] = useState<{
    latitude: number;
    longitude: number;
    driverName?: string;
    lastUpdated: string;
  } | null>(null);

  // Filter locations for the specific bus
  useEffect(() => {
    const busData = locations.find(
      loc => loc.bus_number === studentBusNumber && loc.user_type === 'driver' && loc.is_active
    );

    if (busData) {
      setBusLocation({
        latitude: busData.latitude,
        longitude: busData.longitude,
        driverName: busData.driver_name,
        lastUpdated: new Date(busData.timestamp).toLocaleTimeString()
      });
    } else {
      // If no active live location, try to fetch from students/driver data
      setBusLocation(null);
    }
  }, [locations, studentBusNumber]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          Live Bus Tracking - {studentBusNumber}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {busLocation ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="default">Live</Badge>
                <span className="text-sm text-muted-foreground">
                  Updated: {busLocation.lastUpdated}
                </span>
              </div>
              {busLocation.driverName && (
                <span className="text-sm font-medium">
                  Driver: {busLocation.driverName}
                </span>
              )}
            </div>

            <div className="aspect-video w-full h-64 bg-gray-100 rounded-md overflow-hidden">
              <LiveBusLocation
                latitude={busLocation.latitude}
                longitude={busLocation.longitude}
                busNumber={studentBusNumber}
                guardianLatitude={guardianLocation?.latitude ?? null}
                guardianLongitude={guardianLocation?.longitude ?? null}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Latitude
                </p>
                <p className="text-muted-foreground">{busLocation.latitude.toFixed(6)}</p>
              </div>
              <div>
                <p className="font-medium flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Longitude
                </p>
                <p className="text-muted-foreground">{busLocation.longitude.toFixed(6)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="flex flex-col items-center gap-2">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">Waiting for live location data...</p>
              <p className="text-sm text-muted-foreground">
                Bus {studentBusNumber} is not currently sharing location
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LiveTrackingMap;
