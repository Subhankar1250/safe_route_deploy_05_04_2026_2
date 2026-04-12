"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { notifyDriverGuardians } from "@/services/guardianTripNotifications";
import { useToast } from "@/hooks/use-toast";

type Props = {
  driverId: string;
  driverName: string;
  busNumber: string;
  tripActive: boolean;
};

const DELAYS = [
  { label: "+5 min late", minutes: 5 },
  { label: "+10 min late", minutes: 10 },
  { label: "+15 min late", minutes: 15 },
] as const;

export function DriverDelayToParents({ driverId, driverName, busNumber, tripActive }: Props) {
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const send = async (minutes: number) => {
    if (!tripActive || sending) return;
    setSending(true);
    try {
      const bn = busNumber?.trim() || "—";
      await notifyDriverGuardians({
        driverId,
        title: `Bus running about ${minutes} minutes late`,
        body: `${driverName} (Bus #${bn}) says the bus is delayed by about ${minutes} minutes. Check the app for live location.`,
        step: "driver_delay_notice",
        data: {
          bus_number: bn,
          driver_name: driverName,
          delay_minutes: minutes,
          skip_quiet_hours: false,
        },
      });
      toast({
        title: "Parents notified",
        description: `Guardians on this route were sent a ${minutes}-minute delay notice.`,
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Could not notify parents",
        description: e instanceof Error ? e.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="rounded-2xl border-amber-200/60 bg-amber-50/40 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-amber-950 dark:text-amber-50">
          <Clock className="h-5 w-5" />
          Tell parents: running late
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Sends a push and in-app message to guardians on this bus. Use when you are delayed but still
          driving.
        </p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {DELAYS.map((d) => (
          <Button
            key={d.minutes}
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-xl"
            disabled={!tripActive || sending}
            onClick={() => void send(d.minutes)}
          >
            {d.label}
          </Button>
        ))}
        {!tripActive ? (
          <p className="w-full text-xs text-muted-foreground">Start a trip to enable delay notices.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
