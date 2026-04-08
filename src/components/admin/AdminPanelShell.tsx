"use client";

import React, { useEffect, useState } from "react";
import AdminHeader from "@/components/admin/dashboard/AdminHeader";
import FloatingChatButton from "@/components/chat/FloatingChatButton";
import {
  AdminCommandPalette,
  useAdminCommandPaletteShortcut,
} from "@/components/admin/layout/AdminCommandPalette";
import { AdminSidebar } from "@/components/admin/layout/AdminSidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CreditSep } from "@/components/ui/CreditSep";

function AdminAnalyticsFooterNote() {
  const gaAdmin = process.env.NEXT_PUBLIC_GA_ID_ADMIN?.trim();
  const clarityAdmin = process.env.NEXT_PUBLIC_CLARITY_ID_ADMIN?.trim();
  if (!gaAdmin && !clarityAdmin) return null;
  return (
    <p className="mt-2 max-w-2xl mx-auto text-[10px] leading-snug text-muted-foreground/90">
      Admin dashboard session measurement:{" "}
      {gaAdmin ? (
        <>
          Google Analytics{" "}
          <span className="font-mono text-foreground/70">{gaAdmin}</span>
        </>
      ) : (
        <>Google Analytics (main site property)</>
      )}
      {" · "}
      {clarityAdmin ? (
        <>
          Microsoft Clarity{" "}
          <span className="font-mono text-foreground/70">{clarityAdmin}</span>
        </>
      ) : (
        <>Microsoft Clarity (main site project)</>
      )}
    </p>
  );
}

export default function AdminPanelShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [displayName, setDisplayName] = useState("Admin");

  useAdminCommandPaletteShortcut(setCommandOpen);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sishu_tirtha_user");
      if (raw) {
        const u = JSON.parse(raw) as { username?: string };
        if (u.username) setDisplayName(u.username);
      }
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-background to-slate-100/80 dark:from-slate-950 dark:via-background dark:to-slate-900/90">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border/60 bg-card/90 shadow-sm backdrop-blur-md lg:block">
          <AdminSidebar />
        </aside>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-[min(100vw-2rem,20rem)] border-r border-border/60 p-0">
            <AdminSidebar onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader
            user={{ name: displayName }}
            onMenuClick={() => setMobileNavOpen(true)}
            onOpenCommandPalette={() => setCommandOpen(true)}
          />
          <main className="flex-1 px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-7xl rounded-2xl border border-border/50 bg-card/90 p-4 shadow-sm backdrop-blur-sm sm:p-6 lg:p-8">
              {children}
            </div>
          </main>
          <footer className="shrink-0 border-t border-border/40 px-3 py-3 text-center text-[11px] text-muted-foreground sm:px-5 lg:px-8">
            <span className="inline-flex flex-wrap items-center justify-center gap-x-0 font-medium text-foreground/80">
              Sishu Tirtha
              <CreditSep className="text-muted-foreground/80" />
              Safe Route
              <CreditSep className="text-muted-foreground/80" />
              <span className="font-normal text-muted-foreground">© {new Date().getFullYear()}</span>
              <CreditSep className="text-muted-foreground/80" />
              <span className="font-normal">The Phoenix Devs</span>
              <CreditSep className="text-muted-foreground/80" />
              <span className="font-normal">Subhankar Ghorui</span>
            </span>
            <AdminAnalyticsFooterNote />
          </footer>
        </div>
      </div>
      <FloatingChatButton />
      <AdminCommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
