"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSimpleAuth } from "@/hooks/useSimpleAuth";
import { useToast } from "@/hooks/use-toast";

export function AdminGuardianNotificationRetention() {
  const { user } = useSimpleAuth();
  const { toast } = useToast();
  const [days, setDays] = useState("90");
  const [busy, setBusy] = useState(false);

  const runPurge = async () => {
    if (!user?.id) return;
    const n = parseInt(days, 10);
    if (Number.isNaN(n) || n < 7 || n > 730) {
      toast({
        title: "Invalid retention",
        description: "Enter a number of days between 7 and 730.",
        variant: "destructive",
      });
      return;
    }
    const ok = window.confirm(
      `Delete all guardian in-app notifications older than ${n} days? This cannot be undone.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("admin_purge_old_guardian_notifications", {
        p_admin_profile_id: user.id,
        p_days: n,
      });
      if (error) throw error;
      const deleted = typeof data === "number" ? data : 0;
      toast({
        title: "Purge complete",
        description: `Removed ${deleted} notification row(s).`,
      });
    } catch (e) {
      toast({
        title: "Purge failed",
        description: e instanceof Error ? e.message : "Could not purge notifications",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Guardian notification log</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Remove old rows from <code className="text-xs">guardian_notifications</code> to keep storage small.
          Recent history for parents is preserved according to the age you choose.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="purge-days">Older than (days)</Label>
            <Input
              id="purge-days"
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder="90"
            />
          </div>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void runPurge()}>
            <Trash2 className="mr-2 h-4 w-4" aria-hidden />
            {busy ? "Working…" : "Purge old records"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
