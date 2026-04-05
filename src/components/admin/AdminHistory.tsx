import React, { useState, useEffect } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { tripService, TripSession } from '@/services/tripService';
import { useToast } from '@/hooks/use-toast';

interface TripRecord {
  id: string;
  busNumber: string;
  driverName: string;
  date: Date;
  startTime: string;
  endTime: string;
  route: string;
  status: 'completed' | 'cancelled' | 'in-progress' | 'active';
}

const AdminHistory: React.FC = () => {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [dateFilter, setDateFilter] = useState('');
  const [busFilter, setBusFilter] = useState('');

  useEffect(() => {
    fetchTripHistory();
  }, []);

  const fetchTripHistory = async () => {
    try {
      setLoading(true);
      const tripSessions = await tripService.getTripHistory(200);

      const transformedTrips: TripRecord[] = tripSessions.map((session) => {
        const driverName = session.drivers?.name?.trim() || "Unknown driver";
        const routeName = session.routes?.name?.trim() || "No route assigned";
        const st = session.status === "active" ? "in-progress" : session.status;
        return {
          id: session.id,
          busNumber: session.bus_number || "—",
          driverName,
          date: new Date(session.start_time),
          startTime: new Date(session.start_time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          endTime: session.end_time
            ? new Date(session.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "Ongoing",
          route: routeName,
          status: st as TripRecord["status"],
        };
      });
      setTrips(transformedTrips);
    } catch (error: unknown) {
      console.error("Error fetching trip history:", error);
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "Could not load trip history from the database.";
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  const filteredTrips = trips.filter(trip => {
    const matchDate = dateFilter ? trip.date.toLocaleDateString().includes(dateFilter) : true;
    const matchBus = busFilter ? 
      trip.busNumber.toLowerCase().includes(busFilter.toLowerCase()) || 
      trip.driverName.toLowerCase().includes(busFilter.toLowerCase()) : 
      true;
    return matchDate && matchBus;
  });

  // Sort by date and time (most recent first)
  const sortedTrips = [...filteredTrips].sort((a, b) => {
    // First compare by date
    const dateComparison = b.date.getTime() - a.date.getTime();
    if (dateComparison !== 0) return dateComparison;
    
    // If same date, compare by start time
    return a.startTime.localeCompare(b.startTime);
  });

  const getStatusBadgeClass = (status: TripRecord['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Trip History</h2>
        <Button>
          <Calendar className="mr-2 h-4 w-4" /> Export Report
        </Button>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Filter by date (MM/DD/YYYY)"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <Input
            placeholder="Filter by bus or driver"
            value={busFilter}
            onChange={(e) => setBusFilter(e.target.value)}
          />
        </div>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Bus</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead>Start Time</TableHead>
            <TableHead>End Time</TableHead>
            <TableHead>Route</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8">
                Loading trip history...
              </TableCell>
            </TableRow>
          ) : sortedTrips.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8">
                No trip history found
              </TableCell>
            </TableRow>
          ) : (
            sortedTrips.map((trip) => (
              <TableRow key={trip.id}>
                <TableCell>{trip.date.toLocaleDateString()}</TableCell>
                <TableCell>{trip.busNumber}</TableCell>
                <TableCell>{trip.driverName}</TableCell>
                <TableCell>{trip.startTime}</TableCell>
                <TableCell>{trip.endTime || 'N/A'}</TableCell>
                <TableCell>{trip.route}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(trip.status)}`}>
                    {trip.status}
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default AdminHistory;
