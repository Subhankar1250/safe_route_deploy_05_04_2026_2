"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSimpleAuth } from "@/hooks/useSimpleAuth";

type HealthJson = {
  fresh_last_2m?: number;
  stale_active?: number;
  inactive_rows?: number;
};

export function AdminBusLocationHealth() {
  const { user } = useSimpleAuth();
  const [data, setData] = useState<HealthJson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data: raw, error: rpcError } = await supabase.rpc("get_admin_bus_location_health", {
        p_admin_profile_id: user.id,
      });
      if (rpcError) throw rpcError;
      setData((raw as HealthJson) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load bus location health");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Activity className="h-5 w-5" aria-hidden />
          Live bus pings
        </CardTitle>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Driver rows in <code className="text-xs">live_locations</code>: fresh if last ping is within 2 minutes
          and trip is active.
        </p>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : data ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <dt className="text-xs font-medium text-muted-foreground">Fresh (≤ 2 min)</dt>
              <dd className="text-2xl font-semibold tabular-nums">{data.fresh_last_2m ?? 0}</dd>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <dt className="text-xs font-medium text-muted-foreground">Stale (active)</dt>
              <dd className="text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {data.stale_active ?? 0}
              </dd>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <dt className="text-xs font-medium text-muted-foreground">Inactive rows</dt>
              <dd className="text-2xl font-semibold tabular-nums">{data.inactive_rows ?? 0}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No data.</p>
        )}
      </CardContent>
    </Card>
  );
}
