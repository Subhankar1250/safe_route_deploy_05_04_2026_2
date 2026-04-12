import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PickupDropEvent {
  id: string;
  student_id: string;
  student_name: string;
  driver_name: string;
  event_type: "pickup" | "drop";
  event_time: string;
  location_lat?: number;
  location_lng?: number;
  location_name?: string;
  bus_number: string;
  notes?: string;
}

export const usePickupDropHistory = (guardianProfileId: string | null) => {
  const [history, setHistory] = useState<PickupDropEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchHistory = useCallback(async () => {
    if (!guardianProfileId) return;
    try {
      const { data, error } = await supabase.rpc("get_guardian_pickup_drop_history", {
        guardian_profile_id: guardianProfileId,
      });

      if (error) {
        console.error("Error loading pickup drop history:", error);
        toast({
          title: "Error",
          description: "Failed to load pickup/drop history",
          variant: "destructive",
        });
        return;
      }

      setHistory(
        (data ?? []).map((item: Record<string, unknown>) => ({
          ...item,
          event_type: item.event_type as "pickup" | "drop",
        })) as PickupDropEvent[],
      );
    } catch (error) {
      console.error("Error loading pickup drop history:", error);
      toast({
        title: "Error",
        description: "Failed to load pickup/drop history",
        variant: "destructive",
      });
    }
  }, [guardianProfileId, toast]);

  useEffect(() => {
    if (!guardianProfileId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      await fetchHistory();
      if (!cancelled) setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [guardianProfileId, fetchHistory]);

  const studentIdsKey = useMemo(
    () =>
      [...new Set(history.map((h) => h.student_id))]
        .filter(Boolean)
        .sort()
        .join(","),
    [history],
  );

  useEffect(() => {
    if (!guardianProfileId || !studentIdsKey) return;

    const ids = studentIdsKey.split(",").filter(Boolean);
    if (ids.length === 0) return;

    const filter = `student_id=in.(${ids.join(",")})`;

    const channel = supabase
      .channel(`pickup_drop_guardian_${guardianProfileId}_${studentIdsKey.slice(0, 60)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pickup_drop_history",
          filter,
        },
        () => {
          void fetchHistory();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [guardianProfileId, studentIdsKey, fetchHistory]);

  return {
    history,
    loading,
  };
};
