import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logUserLogin } from "@/services/userLogService";
import { mobileLookupVariants } from "@/utils/phone";
import { getNextMidnightISTMs } from "@/utils/istMidnight";
import { revokeGuardianWebPush } from "@/services/guardianPushService";

export interface User {
  id: string;
  email: string;
  username: string;
  user_type: "admin" | "driver" | "guardian" | "guardian_admin";
  mobile_number?: string;
  /**
   * Drivers only: Unix ms when this login expires (midnight IST). Others stay logged in until manual logout.
   */
  sessionExpiresAt?: number | null;
}

type ToastFn = (props: {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;

function finishLogin(profile: Record<string, unknown>, toast: ToastFn): User {
  const userData: User = {
    id: profile.id as string,
    email: (profile.email as string) || "",
    username: profile.username as string,
    user_type: profile.user_type as User["user_type"],
    mobile_number: profile.mobile_number as string | undefined,
  };
  if (userData.user_type === "driver") {
    userData.sessionExpiresAt = getNextMidnightISTMs();
  } else {
    userData.sessionExpiresAt = null;
  }
  localStorage.setItem("sishu_tirtha_user", JSON.stringify(userData));
  logUserLogin({
    user_id: userData.id,
    user_type: userData.user_type,
    user_name: userData.username,
  }).catch((e) => console.error("Login logging failed:", e));
  toast({
    title: "Login successful",
    description: `Welcome, ${userData.username}!`,
  });
  return userData;
}

export const useSimpleAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const readStoredUser = (): User | null => {
    const storedUser = localStorage.getItem("sishu_tirtha_user");
    if (!storedUser) return null;
    try {
      const u = JSON.parse(storedUser) as User;
      if (u.user_type === "driver") {
        if (
          u.sessionExpiresAt != null &&
          typeof u.sessionExpiresAt === "number" &&
          Date.now() >= u.sessionExpiresAt
        ) {
          localStorage.removeItem("sishu_tirtha_user");
          return null;
        }
        if (u.sessionExpiresAt == null || typeof u.sessionExpiresAt !== "number") {
          u.sessionExpiresAt = getNextMidnightISTMs();
          localStorage.setItem("sishu_tirtha_user", JSON.stringify(u));
        }
      } else {
        u.sessionExpiresAt = null;
      }
      return u;
    } catch {
      localStorage.removeItem("sishu_tirtha_user");
      return null;
    }
  };

  useEffect(() => {
    const u = readStoredUser();
    if (u) setUser(u);
    setLoading(false);
  }, []);

  const loginWithEmail = async (email: string, _password: string, role: string) => {
    try {
      setLoading(true);
      const cleanEmail = email.trim().toLowerCase();
      const cleanRole = role.trim().toLowerCase();

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", cleanEmail)
        .eq("user_type", cleanRole)
        .maybeSingle();

      if (profileError) {
        throw new Error(`Database error: ${profileError.message}`);
      }

      if (!profile) {
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", cleanEmail);
        if (allProfiles?.length) {
          throw new Error(
            `Account exists as ${allProfiles[0].user_type}, not ${cleanRole}.`,
          );
        }
        throw new Error(`No account found for ${email}.`);
      }

      const userData = finishLogin(profile, toast);
      setUser(userData);
      return userData;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed";
      toast({ title: "Login failed", description: message, variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /** Guardian / driver manual login: registered mobile + 6-digit PIN (verify_portal_pin_login). */
  const loginWithPortalPin = useCallback(
    async (mobileNumber: string, pin: string, role: "guardian" | "driver") => {
      try {
        setLoading(true);
        await supabase.auth.signOut();

        const cleanPin = pin.replace(/\D/g, "").trim();
        if (cleanPin.length !== 6) {
          throw new Error("Enter the 6-digit PIN issued by your school.");
        }

        const variants = mobileLookupVariants(mobileNumber);
        if (!variants.length) {
          throw new Error("Enter a valid 10-digit mobile number.");
        }

        const { data, error } = await supabase.rpc("verify_portal_pin_login", {
          p_mobile: variants[0] ?? mobileNumber.trim(),
          p_pin: cleanPin,
          p_user_type: role,
        });

        if (error) {
          throw new Error(error.message);
        }

        const payload = data as Record<string, unknown> | null;
        if (!payload) {
          throw new Error("Wrong mobile number or PIN. Try again or use Forgot PIN.");
        }

        if (payload.error === "rate_limited") {
          const lu = payload.locked_until;
          let extra = "";
          if (typeof lu === "string") {
            const ms = Date.parse(lu);
            if (Number.isFinite(ms)) {
              const mins = Math.max(1, Math.ceil((ms - Date.now()) / 60000));
              extra = ` Try again in about ${mins} minute(s).`;
            }
          }
          throw new Error(`Too many incorrect PIN attempts.${extra}`);
        }

        if (payload.error === "no_pin_set") {
          throw new Error(
            "Your account does not have a login PIN yet. Ask your school to issue one, or use the WhatsApp help below.",
          );
        }

        if (typeof payload.id !== "string") {
          throw new Error("Wrong mobile number or PIN. Try again or use Forgot PIN.");
        }

        const userData = finishLogin(payload, toast);
        setUser(userData);
        return userData;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Login failed";
        toast({ title: "Login failed", description: message, variant: "destructive" });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  const loginGuardianAdminWithPin = async (mobileNumber: string, pin: string) => {
    try {
      setLoading(true);
      await supabase.auth.signOut();

      const cleanPin = pin.replace(/\D/g, "").trim();
      if (cleanPin.length !== 6) {
        throw new Error("Enter the 6-digit PIN from your school.");
      }

      const { data, error } = await supabase.rpc("verify_guardian_admin_login", {
        p_mobile: mobileNumber.trim(),
        p_pin: cleanPin,
      });

      if (error) {
        throw new Error(error.message);
      }

      const profile = data as Record<string, unknown> | null;
      if (!profile || typeof profile.id !== "string") {
        throw new Error("Wrong mobile or PIN. Contact the school if you forgot your PIN.");
      }

      const userData = finishLogin(
        { ...profile, user_type: "guardian_admin" },
        toast,
      );
      setUser(userData);
      return userData;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed";
      toast({ title: "Login failed", description: message, variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /** Driver login: QR encodes driver UUID + secret qr_token; verified via RPC (no raw table scrape). */
  const loginWithDriverQr = useCallback(async (driverId: string, token: string) => {
    try {
      setLoading(true);
      await supabase.auth.signOut();

      const { data, error } = await supabase.rpc("verify_driver_qr_login", {
        p_driver_id: driverId,
        p_token: token,
      });

      if (error) {
        throw new Error(error.message);
      }

      const profile = data as Record<string, unknown> | null;
      if (!profile || typeof profile.id !== "string") {
        throw new Error(
          "Invalid QR code, or it was renewed. Ask your admin for a new driver QR.",
        );
      }

      const userData = finishLogin(
        { ...profile, user_type: "driver" },
        toast,
      );
      setUser(userData);
      return userData;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed";
      toast({ title: "Login failed", description: message, variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const logout = async () => {
    let guardianProfileId: string | null = null;
    try {
      const raw = localStorage.getItem("sishu_tirtha_user");
      if (raw) {
        const u = JSON.parse(raw) as User;
        if (u.user_type === "guardian") guardianProfileId = u.id;
      }
    } catch {
      /* ignore */
    }

    setUser(null);
    localStorage.removeItem("sishu_tirtha_user");
    localStorage.removeItem("sishuTirthaUser");
    localStorage.removeItem("sishu_tirtha_user_backup");
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("otp_completed_")) localStorage.removeItem(key);
    });
    localStorage.removeItem("sishu_guardian_last_session_ping");
    sessionStorage.clear();

    if (guardianProfileId) {
      await revokeGuardianWebPush(guardianProfileId);
    }

    toast({ title: "Logged out", description: "See you soon." });
  };

  return {
    user,
    loading,
    loginWithEmail,
    loginWithPortalPin,
    loginGuardianAdminWithPin,
    loginWithDriverQr,
    logout,
  };
};
