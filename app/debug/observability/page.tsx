"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { trackEvent } from "@/lib/analytics";
import { trackFirebaseEvent } from "@/lib/firebaseAnalytics";

export default function ObservabilityDebugPage() {
  const [status, setStatus] = useState<string>("");

  const throwClientError = () => {
    trackEvent("debug_throw_client_error_clicked");
    throw new Error("Sentry client test crash");
  };

  const captureHandledClientError = () => {
    trackEvent("debug_capture_handled_error_clicked");
    try {
      throw new Error("Sentry handled client test error");
    } catch (err) {
      Sentry.captureException(err);
      setStatus("Captured handled client error");
    }
  };

  const triggerServerErrorRoute = async () => {
    trackEvent("debug_trigger_server_error_clicked");
    const res = await fetch("/api/test-error");
    const json = (await res.json()) as { message?: string };
    setStatus(json.message ?? "Triggered server error route");
  };

  const triggerGaEvent = () => {
    trackEvent("debug_custom_ga_event", { source: "observability_debug_page" });
    setStatus("Sent GA custom event");
  };

  const triggerFirebaseEvent = async () => {
    await trackFirebaseEvent("debug_custom_firebase_event", {
      source: "observability_debug_page",
    });
    setStatus("Sent Firebase Analytics custom event");
  };

  return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">Observability Debug</h1>
      <p className="text-sm text-muted-foreground">
        Use these buttons to verify Sentry and GA dashboards.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="rounded bg-red-600 px-3 py-2 text-white" onClick={throwClientError}>
          Crash UI (client)
        </button>
        <button className="rounded bg-amber-600 px-3 py-2 text-white" onClick={captureHandledClientError}>
          Capture handled client error
        </button>
        <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={() => void triggerServerErrorRoute()}>
          Trigger server/API error
        </button>
        <button className="rounded bg-emerald-600 px-3 py-2 text-white" onClick={triggerGaEvent}>
          Send GA custom event
        </button>
        <button className="rounded bg-purple-600 px-3 py-2 text-white" onClick={() => void triggerFirebaseEvent()}>
          Send Firebase event
        </button>
      </div>
      {status ? <p className="text-sm">{status}</p> : null}
    </main>
  );
}

