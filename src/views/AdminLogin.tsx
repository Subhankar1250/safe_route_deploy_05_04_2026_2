import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, ArrowLeft, Phone, KeyRound } from "lucide-react";
import { SimpleThemeToggle } from "@/components/ui/theme-toggle";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import LoginHeader from "@/components/auth/LoginHeader";
import LoginFooter from "@/components/auth/LoginFooter";
import { mobileLookupVariants } from "@/utils/phone";
import { logUserLogin } from "@/services/userLogService";
import { useSimpleAuth } from "@/hooks/useSimpleAuth";

const loginShellFallback: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "1rem",
  position: "relative",
  overflow: "hidden",
  background: "linear-gradient(165deg, #020617 0%, #0f172a 38%, #134e4a 72%, #14532d 100%)",
};

const AdminLogin: React.FC = () => {
  const router = useRouter();
  const { toast } = useToast();
  const { loginGuardianAdminWithPin } = useSimpleAuth();

  const [mobileNumber, setMobileNumber] = useState("");
  const [coordMobile, setCoordMobile] = useState("");
  const [coordPin, setCoordPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleMobileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await supabase.auth.signOut();

      const variants = mobileLookupVariants(mobileNumber);
      if (!variants.length) {
        throw new Error("Enter a valid 10-digit mobile number.");
      }

      let adminProfile: Record<string, unknown> | null = null;
      for (const v of variants) {
        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("mobile_number", v)
          .eq("user_type", "admin")
          .maybeSingle();
        if (profileError) throw new Error(profileError.message);
        if (data) {
          adminProfile = data as Record<string, unknown>;
          break;
        }
      }

      if (!adminProfile) {
        throw new Error("No admin account found for this mobile number.");
      }

      const adminUserData = {
        id: adminProfile.id as string,
        email: (adminProfile.email as string) || "",
        username: adminProfile.username as string,
        full_name: (adminProfile.full_name as string | null | undefined) ?? undefined,
        user_type: "admin" as const,
        mobile_number: adminProfile.mobile_number as string | undefined,
      };

      localStorage.setItem("sishu_tirtha_user", JSON.stringify(adminUserData));
      logUserLogin({
        user_id: adminUserData.id,
        user_type: "admin",
        user_name: adminUserData.username,
      }).catch(console.error);

      toast({
        title: "Welcome",
        description: `Signed in as ${adminUserData.username}`,
      });
      router.push("/admin/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      toast({ title: "Login failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCoordinatorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginGuardianAdminWithPin(coordMobile, coordPin);
      router.push("/admin/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-4"
      style={loginShellFallback}
    >
      <div
        className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-blue-500/25 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 h-[24rem] w-[24rem] rounded-full bg-emerald-500/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl"
        aria-hidden
      />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <div className="rounded-full border border-white/10 bg-white/10 p-0.5 shadow-lg backdrop-blur-md dark:bg-slate-900/40">
          <SimpleThemeToggle />
        </div>
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col gap-4">
        <Card className="overflow-hidden border-0 border-white/20 bg-white/85 shadow-2xl shadow-slate-950/40 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/75 dark:shadow-black/50">
          <LoginHeader />

          <div className="px-4 pb-2 pt-1 text-center">
            <Shield className="mx-auto mb-1 h-7 w-7 text-primary" />
            <h2 className="text-lg font-semibold tracking-tight">Admin console</h2>
            <p className="text-xs text-muted-foreground">School admin or parent coordinator</p>
          </div>

          <Tabs defaultValue="school" className="w-full px-1 pb-1">
            <TabsList className="mx-3 mb-2 grid h-11 grid-cols-2 rounded-2xl border border-slate-200/80 bg-slate-100/90 p-1 dark:border-white/10 dark:bg-slate-800/80">
              <TabsTrigger
                value="school"
                className="gap-2 rounded-xl text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-700"
              >
                <Phone size={14} aria-hidden /> School admin
              </TabsTrigger>
              <TabsTrigger
                value="coordinator"
                className="gap-2 rounded-xl text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-700"
              >
                <KeyRound size={14} aria-hidden /> Coordinator
              </TabsTrigger>
            </TabsList>

            {error && (
              <div className="mx-4 mb-2 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <TabsContent value="school" className="mt-0 space-y-0 px-4 pb-4">
              <form onSubmit={handleMobileSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-mobile">Registered admin mobile</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="admin-mobile"
                      type="tel"
                      placeholder="10-digit number"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="pl-10"
                      required
                      disabled={loading}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">No SMS code — must match a full admin profile.</p>
                </div>
                <Button type="submit" className="w-full rounded-xl" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="coordinator" className="mt-0 space-y-0 px-4 pb-4">
              <form onSubmit={handleCoordinatorSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="coord-m">Mobile</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="coord-m"
                      type="tel"
                      placeholder="10-digit number"
                      value={coordMobile}
                      onChange={(e) => setCoordMobile(e.target.value)}
                      className="pl-10"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coord-p">6-digit PIN</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="coord-p"
                      type="password"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      placeholder="••••••"
                      value={coordPin}
                      onChange={(e) => setCoordPin(e.target.value)}
                      className="pl-10 font-mono tracking-widest"
                      required
                      disabled={loading}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">PIN is issued when a school admin creates your coordinator account.</p>
                </div>
                <Button type="submit" className="w-full rounded-xl" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>

        <Button
          type="button"
          variant="ghost"
          className="w-full border border-white/10 bg-white/5 text-slate-100 backdrop-blur-sm hover:bg-white/10 hover:text-white"
          onClick={() => router.push("/login")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Main app login
        </Button>
      </div>

      <LoginFooter />
    </div>
  );
};

export default AdminLogin;
