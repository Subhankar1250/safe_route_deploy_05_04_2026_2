"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { SimpleThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { DashboardDateTime } from "@/components/layout/DashboardDateTime";
import { useAppLanguage } from "@/contexts/AppLanguageContext";

import { BRAND_LOGO_SRC } from "@/lib/brandLogo";

const LOGO = BRAND_LOGO_SRC;

export type MobileAppShellProps = {
  /** Short label shown in the header (e.g. Guardian, Driver) */
  roleLabel: string;
  /** Optional second line under the title */
  subtitle?: string;
  onLogout: () => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
};

/**
 * Phone-first layout for Capacitor: centered column, safe areas, sticky header.
 * Admin routes should not use this — use full-width web layouts instead.
 */
export function MobileAppShell({
  roleLabel,
  subtitle,
  onLogout,
  children,
  className,
}: MobileAppShellProps) {
  const { lang, setLang, t } = useAppLanguage();
  return (
    <div
      className={cn(
        "h-dvh overflow-x-hidden bg-gradient-to-b from-slate-100 via-background to-muted/40 dark:from-slate-950 dark:via-background dark:to-slate-900/80",
        className,
      )}
    >
      <div className="mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
        <header
          className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <img
                src={LOGO}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full ring-2 ring-primary/20"
                width={36}
                height={36}
              />
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sishu Tirtha
                </p>
                <h1 className="truncate text-base font-bold leading-tight text-foreground">
                  {roleLabel}
                </h1>
                {subtitle ? (
                  <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-2 text-xs"
                onClick={() => setLang(lang === "en" ? "bn" : "en")}
              >
                {lang === "en" ? t("lang.bengali") : t("lang.english")}
              </Button>
              <div className="rounded-full border border-border/60 bg-muted/40 p-0.5">
                <SimpleThemeToggle />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 px-2 text-foreground"
                aria-label="Log out"
                onClick={() => void onLogout()}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden text-xs font-medium sm:inline">Log out</span>
              </Button>
            </div>
          </div>
          <div className="border-t border-border/50 bg-muted/30 px-3 py-2 sm:px-4">
            <DashboardDateTime className="w-full justify-center sm:justify-start" />
          </div>
        </header>

        <main
          className="flex-1 overflow-y-auto overscroll-y-contain space-y-4 px-3 py-4 pb-[max(5.5rem,env(safe-area-inset-bottom,0px)+4.5rem)] sm:px-4"
          style={{
            paddingBottom: "max(5.5rem, calc(env(safe-area-inset-bottom, 0px) + 4.5rem))",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
