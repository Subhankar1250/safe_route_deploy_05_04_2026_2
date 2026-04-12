"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Smartphone, Users } from "lucide-react";
import GuardianLoginTab from "./GuardianLoginTab";
import DriverLoginTab from "./DriverLoginTab";
import LoginHeader from "./LoginHeader";
import LoginFooter from "./LoginFooter";
import { AppAiHelpAssistant } from "@/components/help/AppAiHelpAssistant";
import { LoginSupportWhatsApp } from "./LoginSupportWhatsApp";
import { SimpleThemeToggle } from "@/components/ui/theme-toggle";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSimpleAuth } from "@/hooks/useSimpleAuth";
import { shouldHideAdminLoginLink } from "@/lib/nativeAndroidApp";
import { trackEvent } from "@/lib/analytics";
import {
  clearGuardianSavedCredentials,
  readGuardianSavedCredentials,
  writeGuardianSavedCredentials,
} from "@/services/guardianSavedCredentials";

/** Inline fallbacks only — do NOT set `overflow: hidden` here: it overrides Tailwind `overflow-y-auto`
 *  and traps tall mobile layouts so Login / Forgot PIN sit below the fold with no scroll. */
const loginShellFallback: React.CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  padding: "1rem",
  paddingTop: "max(1rem, env(safe-area-inset-top, 0px))",
  paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))",
  position: "relative",
  overflowX: "hidden",
  background: "linear-gradient(165deg, #020617 0%, #0f172a 38%, #134e4a 72%, #14532d 100%)",
  /* Readable default when Tailwind utilities fail to load */
  color: "rgb(226, 232, 240)",
};

const Login: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithPortalPin, loginWithDriverQr } = useSimpleAuth();
  const [mobileNumber, setMobileNumber] = useState("");
  const [pin, setPin] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const credentialsHydratedRef = useRef(false);
  const [role, setRole] = useState<"guardian" | "driver">("guardian");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hideAdminLink, setHideAdminLink] = useState(false);

  useLayoutEffect(() => {
    setHideAdminLink(shouldHideAdminLoginLink());
  }, []);

  useEffect(() => {
    if (credentialsHydratedRef.current) return;
    credentialsHydratedRef.current = true;
    void (async () => {
      const saved = await readGuardianSavedCredentials();
      if (saved) {
        setMobileNumber(saved.mobile);
        setPin(saved.pin);
        setRememberMe(true);
      }
    })();
  }, []);

  /** Dynamic driver link: `/login?driver_id=<uuid>&token=<qr_token>` — same verification as QR scan. */
  useEffect(() => {
    const driverId = searchParams.get("driver_id");
    const token = searchParams.get("token");
    if (!driverId || !token) return;

    const ac = new AbortController();
    let cancelled = false;

    const run = async () => {
      setError(null);
      setLoading(true);
      try {
        await loginWithDriverQr(driverId, token);
        if (cancelled || ac.signal.aborted) return;
        router.replace("/driver/dashboard");
      } catch (err) {
        if (cancelled || ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Quick link login failed");
        router.replace("/login");
      } finally {
        if (!cancelled && !ac.signal.aborted) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [searchParams, loginWithDriverQr, router]);

  const driverMidnightMessage =
    searchParams.get("reason") === "driver_midnight"
      ? "Driver sessions end at midnight India time. Please sign in again to continue."
      : null;

  const nativeAndroidStaffMessage =
    searchParams.get("reason") === "native_android"
      ? "This Android app is for parents and drivers only. School staff should use the website in a browser."
      : null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    trackEvent("login_submit", { role });
    setError(null);
    setLoading(true);
    try {
      await loginWithPortalPin(mobileNumber, pin, role);
      if (role === "guardian") {
        if (rememberMe) await writeGuardianSavedCredentials(mobileNumber, pin);
        else await clearGuardianSavedCredentials();
      }
      trackEvent("login_success", { role });
      if (role === "driver") router.push("/driver/dashboard");
      else router.push("/guardian/dashboard");
    } catch (err: unknown) {
      trackEvent("login_failure", { role });
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDriverQrLogin = async (driverId: string, token: string) => {
    setError(null);
    setLoading(true);
    try {
      await loginWithDriverQr(driverId, token);
      router.push("/driver/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "QR login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-dvh w-full flex-col items-center justify-start gap-4 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-3 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(3rem,env(safe-area-inset-bottom,0px))] sm:justify-center sm:px-4 sm:py-10 sm:pb-12"
      style={loginShellFallback}
    >
      <div
        className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] animate-pulse-slow rounded-full bg-blue-500/20 blur-3xl motion-reduce:animate-none"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 h-[24rem] w-[24rem] animate-pulse-slow rounded-full bg-emerald-500/15 blur-3xl motion-reduce:animate-none [animation-delay:1s]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.12),transparent)]"
        aria-hidden
      />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <div className="rounded-2xl border border-white/20 bg-white/10 p-1 shadow-xl shadow-slate-950/20 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/30">
          <SimpleThemeToggle />
        </div>
      </div>

      <div className="relative z-10 flex w-full max-w-[28rem] flex-col gap-5 sm:gap-6">
        {driverMidnightMessage ? (
          <Alert className="rounded-2xl border-amber-200/80 bg-amber-50/95 text-amber-950 shadow-md dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-50">
            <AlertTitle>Session ended</AlertTitle>
            <AlertDescription>{driverMidnightMessage}</AlertDescription>
          </Alert>
        ) : null}
        {nativeAndroidStaffMessage ? (
          <Alert className="rounded-2xl border-sky-200/80 bg-sky-50/95 text-sky-950 shadow-md dark:border-sky-500/40 dark:bg-sky-950/40 dark:text-sky-50">
            <AlertTitle>Mobile app</AlertTitle>
            <AlertDescription>{nativeAndroidStaffMessage}</AlertDescription>
          </Alert>
        ) : null}
        <Card
          className="animate-in fade-in zoom-in-95 w-full max-w-full overflow-x-clip overflow-y-visible border-0 border-white/25 bg-white/90 shadow-2xl shadow-slate-950/50 duration-500 fill-mode-both backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80 dark:shadow-black/60 sm:duration-700"
          style={{
            borderRadius: "1.25rem",
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.4) inset, 0 25px 50px -12px rgba(15, 23, 42, 0.5), 0 12px 24px -8px rgba(15, 23, 42, 0.25)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <div
            className="h-1 w-full bg-gradient-to-r from-sky-500 via-emerald-500 to-teal-400 opacity-90"
            aria-hidden
          />
          <LoginHeader />

          <Tabs
            value={role}
            className="w-full"
            onValueChange={(v) => {
              setRole(v as "guardian" | "driver");
              setPin("");
            }}
          >
            <TabsList className="mx-4 mb-1 grid h-[3.25rem] grid-cols-2 gap-1.5 rounded-2xl border border-slate-200/90 bg-slate-100/95 p-1.5 shadow-inner dark:border-white/10 dark:bg-slate-900/90">
              <TabsTrigger
                value="guardian"
                className="gap-2 rounded-xl text-sm font-semibold text-slate-600 transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md data-[state=inactive]:hover:bg-white/50 data-[state=inactive]:hover:text-slate-800 dark:text-slate-300 dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-white dark:data-[state=inactive]:hover:bg-slate-800/80 dark:data-[state=inactive]:hover:text-white"
              >
                <Users className="h-4 w-4 shrink-0 opacity-80" aria-hidden /> Guardian
              </TabsTrigger>
              <TabsTrigger
                value="driver"
                className="gap-2 rounded-xl text-sm font-semibold text-slate-600 transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md data-[state=inactive]:hover:bg-white/50 data-[state=inactive]:hover:text-slate-800 dark:text-slate-300 dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-white dark:data-[state=inactive]:hover:bg-slate-800/80 dark:data-[state=inactive]:hover:text-white"
              >
                <Smartphone className="h-4 w-4 shrink-0 opacity-80" aria-hidden /> Driver
              </TabsTrigger>
            </TabsList>

            <LoginSupportWhatsApp activeRole={role} />

            <TabsContent value="guardian" className="px-0 pb-1 focus-visible:outline-none">
              <GuardianLoginTab
                mobileNumber={mobileNumber}
                setMobileNumber={setMobileNumber}
                pin={pin}
                setPin={setPin}
                rememberMe={rememberMe}
                setRememberMe={setRememberMe}
                onClearSavedLogin={() => {
                  void clearGuardianSavedCredentials();
                  setMobileNumber("");
                  setPin("");
                  setRememberMe(false);
                }}
                handleLogin={handleLogin}
                error={error}
                loading={loading}
              />
            </TabsContent>

            <TabsContent value="driver" className="px-0 pb-1 focus-visible:outline-none">
              <DriverLoginTab
                mobileNumber={mobileNumber}
                setMobileNumber={setMobileNumber}
                pin={pin}
                setPin={setPin}
                handleLogin={handleLogin}
                error={error}
                loading={loading}
                onSecureQrLogin={handleDriverQrLogin}
              />
            </TabsContent>
          </Tabs>
        </Card>

        {!hideAdminLink ? (
          <div className="mx-auto w-full max-w-[28rem] rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center shadow-lg backdrop-blur-md">
            <p className="text-sm text-white/90">
              School staff?{" "}
              <Link
                href="/admin"
                className="font-semibold text-emerald-200 underline decoration-emerald-200/50 underline-offset-4 transition hover:text-white hover:decoration-white/80"
              >
                Admin sign-in
              </Link>
            </p>
          </div>
        ) : (
          <p className="text-center text-xs leading-relaxed text-white/65">
            Driver or guardian sign-in only in this app.
          </p>
        )}

        <div className="mx-auto flex w-full max-w-[28rem] justify-center">
          <div className="rounded-2xl border border-white/25 bg-white/10 p-1 shadow-md backdrop-blur-md [&_button]:border-white/30 [&_button]:bg-white/15 [&_button]:text-white [&_button]:hover:bg-white/25">
            <AppAiHelpAssistant contextLabel="Login" />
          </div>
        </div>

        <LoginFooter />
      </div>
    </div>
  );
};

export default Login;
