"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, RefreshCw } from "lucide-react";
import { tripService } from "@/services/tripService";
import { useToast } from "@/hooks/use-toast";
import { useSimpleAuth } from "@/hooks/useSimpleAuth";
import { supabase } from "@/integrations/supabase/client";

interface TripRecord {
  id: string;
  busNumber: string;
  driverName: string;
  date: Date;
  startTime: string;
  endTime: string;
  route: string;
  status: "completed" | "cancelled" | "in-progress" | "active";
}

type PickupDropAdminRow = {
  id: string;
  student_id: string;
  student_name: string;
  guardian_name: string;
  driver_name: string;
  event_type: string;
  event_time: string;
  bus_number: string | null;
  location_name: string | null;
  notes: string | null;
};

const AdminHistory: React.FC = () => {
  const { user } = useSimpleAuth();
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [pickupRows, setPickupRows] = useState<PickupDropAdminRow[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [loadingPickup, setLoadingPickup] = useState(false);
  const { toast } = useToast();
  const [dateFilter, setDateFilter] = useState("");
  const [busFilter, setBusFilter] = useState("");
  const [pickupFilter, setPickupFilter] = useState("");

  const fetchTripHistory = useCallback(async () => {
    try {
      setLoadingTrips(true);
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
      setLoadingTrips(false);
    }
  }, [toast]);

  const fetchPickupDropHistory = useCallback(async () => {
    if (!user?.id || (user.user_type !== "admin" && user.user_type !== "guardian_admin")) {
      setPickupRows([]);
      return;
    }
    try {
      setLoadingPickup(true);
      const { data, error } = await supabase.rpc("get_admin_pickup_drop_history", {
        p_admin_profile_id: user.id,
        p_limit: 300,
      });
      if (error) throw error;
      setPickupRows((data as PickupDropAdminRow[]) ?? []);
    } catch (error: unknown) {
      console.error("Error fetching pickup/drop history:", error);
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "Could not load pickup/drop history. Apply the latest database migration if this is new.";
      toast({
        title: "Pickup / drop history",
        description: msg,
        variant: "destructive",
      });
      setPickupRows([]);
    } finally {
      setLoadingPickup(false);
    }
  }, [user?.id, user?.user_type, toast]);

  useEffect(() => {
    void fetchTripHistory();
  }, [fetchTripHistory]);

  useEffect(() => {
    void fetchPickupDropHistory();
  }, [fetchPickupDropHistory]);

  const filteredTrips = trips.filter((trip) => {
    const matchDate = dateFilter ? trip.date.toLocaleDateString().includes(dateFilter) : true;
    const matchBus = busFilter
      ? trip.busNumber.toLowerCase().includes(busFilter.toLowerCase()) ||
        trip.driverName.toLowerCase().includes(busFilter.toLowerCase())
      : true;
    return matchDate && matchBus;
  });

  const sortedTrips = [...filteredTrips].sort((a, b) => {
    const dateComparison = b.date.getTime() - a.date.getTime();
    if (dateComparison !== 0) return dateComparison;
    return a.startTime.localeCompare(b.startTime);
  });

  const filteredPickup = pickupRows.filter((row) => {
    if (!pickupFilter.trim()) return true;
    const q = pickupFilter.toLowerCase();
    return (
      (row.student_name ?? "").toLowerCase().includes(q) ||
      (row.driver_name ?? "").toLowerCase().includes(q) ||
      (row.guardian_name ?? "").toLowerCase().includes(q) ||
      (row.bus_number ?? "").toLowerCase().includes(q) ||
      (row.event_type ?? "").toLowerCase().includes(q)
    );
  });

  const getStatusBadgeClass = (status: TripRecord["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "in-progress":
        return "bg-blue-100 text-blue-800";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold">Trip & activity history</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchTripHistory()}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingTrips ? "animate-spin" : ""}`} />
            Refresh trips
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchPickupDropHistory()}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingPickup ? "animate-spin" : ""}`} />
            Refresh pickups/drops
          </Button>
          <Button type="button" variant="secondary" size="sm">
            <Calendar className="mr-2 h-4 w-4" /> Export report
          </Button>
        </div>
      </div>

      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="sessions">Bus trip sessions</TabsTrigger>
          <TabsTrigger value="pickups">Student pickup &amp; drop</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Driver <strong>Start trip</strong> / <strong>End trip</strong> records. This is separate from
            individual student check-in events.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Input
                placeholder="Filter by date (locale date string)"
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
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingTrips ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center">
                    Loading trip history…
                  </TableCell>
                </TableRow>
              ) : sortedTrips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center">
                    No trip sessions found
                  </TableCell>
                </TableRow>
              ) : (
                sortedTrips.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell>{trip.date.toLocaleDateString()}</TableCell>
                    <TableCell>{trip.busNumber}</TableCell>
                    <TableCell>{trip.driverName}</TableCell>
                    <TableCell>{trip.startTime}</TableCell>
                    <TableCell>{trip.endTime || "N/A"}</TableCell>
                    <TableCell>{trip.route}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${getStatusBadgeClass(trip.status)}`}
                      >
                        {trip.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="pickups" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Same events parents see under <strong>Pickup / drop history</strong> on the guardian app — logged
            when the driver checks a student in or out on an active trip.
          </p>
          <Input
            placeholder="Filter by student, driver, guardian, bus, or event type"
            value={pickupFilter}
            onChange={(e) => setPickupFilter(e.target.value)}
            className="max-w-lg"
          />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Guardian</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Bus</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingPickup ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center">
                    Loading pickup &amp; drop events…
                  </TableCell>
                </TableRow>
              ) : filteredPickup.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center">
                    No pickup or drop events yet. They appear when drivers use the student checklist on a trip.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPickup.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(row.event_time).toLocaleString()}
                    </TableCell>
                    <TableCell className="capitalize">{row.event_type}</TableCell>
                    <TableCell>{row.student_name || "—"}</TableCell>
                    <TableCell>{row.guardian_name?.trim() || "—"}</TableCell>
                    <TableCell>{row.driver_name || "—"}</TableCell>
                    <TableCell>{row.bus_number || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {row.location_name || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminHistory;
