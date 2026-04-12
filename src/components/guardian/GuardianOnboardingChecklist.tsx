"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Circle, X } from "lucide-react";
import { useAppLanguage } from "@/contexts/AppLanguageContext";

const DISMISS_KEY = "sishu_guardian_onboarding_v1_dismissed";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function GuardianOnboardingChecklist({
  hasLocation,
}: {
  hasLocation: boolean;
}) {
  const { t } = useAppLanguage();
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    setHydrated(true);
  }, []);

  if (!hydrated || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const Item = ({ done, label, action }: { done: boolean; label: string; action?: () => void }) => (
    <li className="flex items-start gap-2 text-sm">
      {done ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span className="flex-1 leading-snug">{label}</span>
      {action ? (
        <Button type="button" variant="link" size="sm" className="h-auto shrink-0 px-1 py-0" onClick={action}>
          {t("guardian.onboardingGo")}
        </Button>
      ) : null}
    </li>
  );

  return (
    <Card className="rounded-2xl border-primary/25 bg-primary/5 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">{t("guardian.onboardingTitle")}</CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={dismiss}
          aria-label={t("guardian.onboardingDismiss")}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <p className="text-xs text-muted-foreground">{t("guardian.onboardingHint")}</p>
        <ul className="space-y-2">
          <Item
            done={false}
            label={t("guardian.onboardingStepNotif")}
            action={() => scrollToId("section-g-notices")}
          />
          <Item done={hasLocation} label={t("guardian.onboardingStepLocation")} />
          <Item
            done={false}
            label={t("guardian.onboardingStepMap")}
            action={() => scrollToId("section-g-map")}
          />
        </ul>
      </CardContent>
    </Card>
  );
}
