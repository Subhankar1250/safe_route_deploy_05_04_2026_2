import React from "react";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import MobileNumberField from "./MobileNumberField";
import ErrorAlert from "./ErrorAlert";
import { ForgotPinDialog } from "./ForgotPinDialog";
import { useAppLanguage } from "@/contexts/AppLanguageContext";

interface GuardianLoginTabProps {
  mobileNumber: string;
  setMobileNumber: (mobileNumber: string) => void;
  pin: string;
  setPin: (pin: string) => void;
  rememberMe: boolean;
  setRememberMe: (v: boolean) => void;
  onClearSavedLogin: () => void;
  handleLogin: (e: React.FormEvent) => void;
  error: string | null;
  loading?: boolean;
}

const GuardianLoginTab: React.FC<GuardianLoginTabProps> = ({
  mobileNumber,
  setMobileNumber,
  pin,
  setPin,
  rememberMe,
  setRememberMe,
  onClearSavedLogin,
  handleLogin,
  error,
  loading = false,
}) => {
  const { t } = useAppLanguage();
  const digits = mobileNumber.replace(/\D/g, "").length;
  const pinDigits = pin.replace(/\D/g, "").length;
  const canSubmit = digits === 10 && pinDigits === 6;

  return (
    <form onSubmit={handleLogin} className="flex flex-col">
      <CardContent className="space-y-4 px-4 pb-3 pt-1 sm:px-6 sm:pb-2">
        <ErrorAlert error={error} />
        <MobileNumberField
          inputId="login-mobile-guardian"
          mobileNumber={mobileNumber}
          setMobileNumber={setMobileNumber}
          placeholder="10-digit mobile number"
        />
        <div className="flex flex-col space-y-2">
          <Label
            htmlFor="login-pin-guardian"
            className="block text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            6-digit PIN
          </Label>
          <Input
            id="login-pin-guardian"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••••"
            className="h-11 rounded-xl tracking-[0.35em] text-center font-mono text-base"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="guardian-remember-login"
              checked={rememberMe}
              onCheckedChange={(c) => setRememberMe(c === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor="guardian-remember-login"
              className="cursor-pointer text-xs font-normal leading-snug text-muted-foreground"
            >
              {t("guardian.loginRemember")}
            </Label>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto self-start px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={onClearSavedLogin}
          >
            {t("guardian.loginClearSaved")}
          </Button>
        </div>
        <div className="flex justify-end">
          <ForgotPinDialog role="guardian" />
        </div>
        <p className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground dark:border-slate-700 dark:bg-slate-900/40">
          Use the mobile number on file with your school and the 6-digit PIN they sent you (e.g. on
          WhatsApp).
        </p>
      </CardContent>
      <CardFooter className="mt-auto flex flex-col px-4 pb-6 pt-0 sm:px-6 sm:pt-2">
        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-gradient-to-r from-sishu-primary to-blue-700 text-base font-semibold text-white shadow-lg shadow-blue-900/25 transition-all hover:from-blue-700 hover:to-sishu-primary hover:shadow-xl hover:shadow-blue-900/30 active:scale-[0.99] disabled:opacity-60"
          disabled={loading || !canSubmit}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
              Signing in…
            </>
          ) : (
            "Login"
          )}
        </Button>
      </CardFooter>
    </form>
  );
};

export default GuardianLoginTab;
