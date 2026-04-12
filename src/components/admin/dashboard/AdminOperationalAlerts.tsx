"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bus, RefreshCw, Siren } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSimpleAuth } from "@/hooks/useSimpleAuth";
import Link from "next/link";

type AlertsJson = {
  open_panic_alerts?: number;
  stale_active_buses?: number;
  active_trip_sessions?: number;
};

export function AdminOperationalAlerts() {
  const { user } = useSimpleAuth();
  const [data, setData] = useState<AlertsJson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data: raw, error: rpcError } = await supabase.rpc("get_admin_operational_alerts", {
        p_admin_profile_id: user.id,
      });
      if (rpcError) throw rpcError;
      setData((raw as AlertsJson) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load alerts");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const panic = data?.open_panic_alerts ?? 0;
  const stale = data?.stale_active_buses ?? 0;
  const trips = data?.active_trip_sessions ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Operational alerts</CardTitle>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p className="text-sm text-destructive">
            {error}
            {error.toLowerCase().includes("function") || error.toLowerCase().includes("does not exist") ? (
              <span className="mt-1 block text-xs text-muted-foreground">
                Run the latest Supabase migration that adds <code>get_admin_operational_alerts</code>.
              </span>
            ) : null}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <div
            className={`rounded-lg border p-3 ${panic > 0 ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40" : "bg-muted/30"}`}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Siren className="h-4 w-4 text-red-600" />
              Open panic
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{panic}</p>
            {panic > 0 ? (
              <Link href="/admin/drivers" className="mt-2 inline-block text-xs font-medium text-red-700 underline">
                Review drivers / map
              </Link>
            ) : null}
          </div>
          <div
            className={`rounded-lg border p-3 ${stale > 0 ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40" : "bg-muted/30"}`}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Stale live ping
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{stale}</p>
            <p className="mt-1 text-xs text-muted-foreground">Active trip, no GPS update in 2+ min</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Bus className="h-4 w-4" />
              Active trip sessions
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{trips}</p>
            <Link href="/admin/history" className="mt-2 inline-block text-xs underline">
              Trip history
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
