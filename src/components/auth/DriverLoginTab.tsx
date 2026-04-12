import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MobileNumberField from "./MobileNumberField";
import ErrorAlert from "./ErrorAlert";
import { ForgotPinDialog } from "./ForgotPinDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, QrCode, Smartphone } from "lucide-react";

const QrScanner = dynamic(() => import("./QrScanner"), {
  ssr: false,
  loading: () => (
    <p
      style={{
        textAlign: "center",
        color: "#64748b",
        fontSize: "0.875rem",
        padding: "1rem 0",
      }}
    >
      Loading scanner…
    </p>
  ),
});

interface DriverLoginTabProps {
  mobileNumber: string;
  setMobileNumber: (mobileNumber: string) => void;
  pin: string;
  setPin: (pin: string) => void;
  handleLogin: (e: React.FormEvent) => void;
  error: string | null;
  loading?: boolean;
  /** v2 dynamic QR: driverId + token verified server-side */
  onSecureQrLogin?: (driverId: string, token: string) => Promise<void>;
}

const DriverLoginTab: React.FC<DriverLoginTabProps> = ({
  mobileNumber,
  setMobileNumber,
  pin,
  setPin,
  handleLogin,
  error,
  loading = false,
  onSecureQrLogin,
}) => {
  const [loginMethod, setLoginMethod] = useState<"mobile" | "qr">("mobile");
  const [qrBusy, setQrBusy] = useState(false);
  const { toast } = useToast();

  const handleQRScan = async (decodedText: string) => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(decodedText) as Record<string, unknown>;
    } catch {
      toast({
        title: "Invalid QR",
        description: "This is not a valid driver login code.",
        variant: "destructive",
      });
      return;
    }

    const v = parsed.v;
    const driverId = (parsed.driverId as string) || (parsed.driver_id as string);
    const token = (parsed.token as string) || (parsed.t as string);

    if (v === 2 && driverId && token && onSecureQrLogin) {
      try {
        setQrBusy(true);
        await onSecureQrLogin(driverId, token);
      } catch {
        /* parent sets error */
      } finally {
        setQrBusy(false);
      }
      return;
    }

    if (parsed.mobileNumber) {
      setMobileNumber(String(parsed.mobileNumber).replace(/\D/g, "").slice(-10));
      setLoginMethod("mobile");
      toast({
        title: "Number filled",
        description: "Tap “Continue as driver” to sign in with mobile.",
      });
      return;
    }

    toast({
      title: "Unsupported QR",
      description: "Use the QR from your admin (Driver app), or sign in with mobile.",
      variant: "destructive",
    });
  };

  const busy = loading || qrBusy;
  const digits = mobileNumber.replace(/\D/g, "").length;
  const pinDigits = pin.replace(/\D/g, "").length;
  const canMobileSubmit = digits === 10 && pinDigits === 6;

  return (
    <Tabs
      value={loginMethod}
      onValueChange={(v) => setLoginMethod(v as "mobile" | "qr")}
    >
      <TabsList className="mx-4 mb-3 grid h-[2.75rem] w-[calc(100%-2rem)] grid-cols-2 gap-1 rounded-2xl border border-slate-200/90 bg-slate-100/95 p-1 shadow-inner dark:border-white/10 dark:bg-slate-900/90">
        <TabsTrigger
          value="mobile"
          className="rounded-xl text-sm font-semibold transition-all data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-700"
        >
          <Smartphone className="mr-2 h-4 w-4 opacity-80" /> Mobile
        </TabsTrigger>
        <TabsTrigger
          value="qr"
          className="rounded-xl text-sm font-semibold transition-all data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-700"
        >
          <QrCode className="mr-2 h-4 w-4 opacity-80" /> QR
        </TabsTrigger>
      </TabsList>

      <TabsContent value="mobile">
        <form onSubmit={handleLogin} className="flex flex-col">
          <CardContent className="space-y-4 px-4 pb-3 pt-0 sm:px-6 sm:pb-2">
            <ErrorAlert error={error} />
            <MobileNumberField
              inputId="login-mobile-driver"
              mobileNumber={mobileNumber}
              setMobileNumber={setMobileNumber}
              placeholder="10-digit mobile number"
            />
            <div className="flex flex-col space-y-2">
              <Label
                htmlFor="login-pin-driver"
                className="block text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                6-digit PIN
              </Label>
              <Input
                id="login-pin-driver"
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
            <div className="flex justify-end">
              <ForgotPinDialog role="driver" />
            </div>
            <p className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground dark:border-slate-700 dark:bg-slate-900/40">
              Same number the admin registered for you, plus your 6-digit PIN. Or use the QR tab for
              quick login without typing your PIN.
            </p>
          </CardContent>
          <CardFooter className="mt-auto flex flex-col px-4 pb-6 pt-0 sm:px-6 sm:pt-2">
            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-gradient-to-r from-sishu-primary to-blue-700 text-base font-semibold text-white shadow-lg shadow-blue-900/25 transition-all hover:from-blue-700 hover:to-sishu-primary hover:shadow-xl active:scale-[0.99] disabled:opacity-60"
              disabled={busy || !canMobileSubmit}
            >
              {busy ? (
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
      </TabsContent>

      <TabsContent value="qr" className="mt-0 outline-none">
        <CardContent className="flex flex-col items-center space-y-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-1 sm:space-y-4 sm:px-6 sm:pb-6">
          <ErrorAlert error={error} />
          <QrScanner
            onScan={handleQRScan}
            onError={(e) =>
              toast({ title: "Camera", description: e.message, variant: "destructive" })
            }
          />
          {busy ? (
            <p className="text-center text-sm text-muted-foreground">Signing you in…</p>
          ) : null}
        </CardContent>
      </TabsContent>
    </Tabs>
  );
};

export default DriverLoginTab;
