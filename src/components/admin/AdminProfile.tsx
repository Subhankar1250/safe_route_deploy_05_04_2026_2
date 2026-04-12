"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useSimpleAuth } from "@/hooks/useSimpleAuth";
import { supabase } from "@/integrations/supabase/client";
import { mobileLookupVariants } from "@/utils/phone";
import { Loader2 } from "lucide-react";

function normalizeStoredMobile(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length >= 10) return d.slice(-10);
  return d;
}

const AdminProfile: React.FC = () => {
  const { toast } = useToast();
  const { user, applyUserPatch } = useSimpleAuth();

  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setLoadingProfile(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingProfile(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, username, email, mobile_number")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error(error);
        toast({
          variant: "destructive",
          title: "Could not load profile",
          description: error.message,
        });
        setFullName(user.full_name ?? "");
        setDisplayName(user.username ?? "");
        setEmail(user.email ?? "");
        setMobile(user.mobile_number ?? "");
      } else if (data) {
        setFullName((data.full_name as string | null) ?? "");
        setDisplayName((data.username as string) ?? "");
        setEmail((data.email as string) ?? "");
        setMobile(String((data.mobile_number as string | null) ?? ""));
      }
      setLoadingProfile(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.username, user?.email, user?.mobile_number, user?.full_name, toast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    const trimmedDisplay = displayName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const mobileNorm = normalizeStoredMobile(mobile.trim());

    if (!trimmedDisplay) {
      toast({ variant: "destructive", title: "Display name required", description: "Enter a display name." });
      return;
    }
    if (!trimmedEmail) {
      toast({ variant: "destructive", title: "Email required", description: "Enter a valid email address." });
      return;
    }
    if (mobileNorm.length !== 10) {
      toast({
        variant: "destructive",
        title: "Mobile number",
        description: "Use a 10-digit Indian mobile number (used for admin sign-in).",
      });
      return;
    }

    const variants = mobileLookupVariants(mobileNorm);
    if (!variants.length) {
      toast({ variant: "destructive", title: "Invalid mobile", description: "Check the mobile number." });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          username: trimmedDisplay,
          email: trimmedEmail,
          mobile_number: mobileNorm,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) {
        if (error.code === "23505") {
          throw new Error("That display name or email is already used by another account.");
        }
        throw new Error(error.message);
      }

      applyUserPatch({
        full_name: fullName.trim() || null,
        username: trimmedDisplay,
        email: trimmedEmail,
        mobile_number: mobileNorm,
      });

      toast({
        title: "Profile updated",
        description: "Your admin details were saved. Use the new mobile on the admin login screen if you changed it.",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Update failed";
      toast({ variant: "destructive", title: "Could not save", description: message });
    } finally {
      setSaving(false);
    }
  };

  if (!user || (user.user_type !== "admin" && user.user_type !== "guardian_admin")) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Admin Profile</h2>
        <p className="text-muted-foreground">Sign in as an admin to manage your profile.</p>
      </div>
    );
  }

  const headerLabel = [fullName.trim() || user.full_name, displayName.trim() || user.username]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Admin Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update how you appear in the console and the mobile number used on the admin login screen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
          <CardDescription>
            {loadingProfile ? "Loading…" : headerLabel || user.username}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4 max-w-xl">
            <div className="space-y-2">
              <Label htmlFor="admin-full-name">Full name</Label>
              <Input
                id="admin-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Subhankar Ghorui"
                autoComplete="name"
                disabled={loadingProfile || saving}
              />
              <p className="text-xs text-muted-foreground">Optional. Shown in the header when set.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-display-name">Display name</Label>
              <Input
                id="admin-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Short name shown in the admin bar"
                autoComplete="nickname"
                disabled={loadingProfile || saving}
                required
              />
              <p className="text-xs text-muted-foreground">Must be unique across all profiles.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.org"
                autoComplete="email"
                disabled={loadingProfile || saving}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-mobile">Mobile (10 digits)</Label>
              <Input
                id="admin-mobile"
                inputMode="numeric"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="98XXXXXXXX"
                autoComplete="tel"
                disabled={loadingProfile || saving}
                required
              />
              <p className="text-xs text-muted-foreground">Same number you use on the admin login page.</p>
            </div>

            <Button type="submit" disabled={loadingProfile || saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password &amp; PIN</CardTitle>
          <CardDescription>Admin access uses your registered mobile on the admin login screen.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Guardian coordinators signing in with a coordinator PIN should contact the school to rotate that PIN.
          </p>
          <p>There is no password field here because this deployment uses mobile-based admin access, not email password.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminProfile;
