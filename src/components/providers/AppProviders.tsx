"use client";

import React, { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "@/components/ui/toaster";
import { StaticStylesHealth } from "@/components/providers/StaticStylesHealth";
import { SessionExpiryGuard } from "@/components/providers/SessionExpiryGuard";
import { NativeAndroidAppGuard } from "@/components/providers/NativeAndroidAppGuard";
import { AppLanguageProvider } from "@/contexts/AppLanguageContext";

const ClientBoot = dynamic(
  () => import("./ClientBoot").then((m) => ({ default: m.ClientBoot })),
  { ssr: false },
);

const GuardianForegroundMessages = dynamic(
  () =>
    import("./GuardianForegroundMessages").then((m) => ({
      default: m.GuardianForegroundMessages,
    })),
  { ssr: false },
);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 5 * 60 * 1000,
          },
          mutations: {
            retry: 1,
          },
        },
      }),
  );

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ClientBoot />
        <StaticStylesHealth />
        <SessionExpiryGuard />
        <GuardianForegroundMessages />
        <NativeAndroidAppGuard />
        <AppLanguageProvider>
        <QueryClientProvider client={client}>
          <Suspense
            fallback={
              <div
                style={{
                  minHeight: "100vh",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "hsl(210 20% 98%)",
                }}
              >
                <div
                  style={{
                    width: "2.75rem",
                    height: "2.75rem",
                    borderRadius: "9999px",
                    border: "2px solid hsl(210 79% 46% / 0.35)",
                    borderTopColor: "hsl(210 79% 46%)",
                    animation: "sishu-suspense-spin 0.75s linear infinite",
                  }}
                  aria-label="Loading"
                  role="status"
                />
                <style>{`@keyframes sishu-suspense-spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            }
          >
            <div className="min-h-screen" style={{ minHeight: "100vh" }}>
              {children}
            </div>
          </Suspense>
          <Toaster />
        </QueryClientProvider>
        </AppLanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
