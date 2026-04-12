const STORAGE_KEY = "sishu_guardian_saved_login_v1";

export type GuardianSavedLogin = {
  mobile: string;
  pin: string;
};

function parseStored(raw: string | null): GuardianSavedLogin | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GuardianSavedLogin>;
    const mobile = String(parsed.mobile ?? "").replace(/\D/g, "");
    const pin = String(parsed.pin ?? "").replace(/\D/g, "");
    if (mobile.length !== 10 || pin.length !== 6) return null;
    return { mobile, pin };
  } catch {
    return null;
  }
}

export async function readGuardianSavedCredentials(): Promise<GuardianSavedLogin | null> {
  if (typeof window === "undefined") return null;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      const fromNative = parseStored(value);
      if (fromNative) return fromNative;
    }
  } catch {
    /* fall through */
  }
  return parseStored(localStorage.getItem(STORAGE_KEY));
}

export async function writeGuardianSavedCredentials(mobile: string, pin: string): Promise<void> {
  if (typeof window === "undefined") return;
  const m = mobile.replace(/\D/g, "");
  const p = pin.replace(/\D/g, "");
  if (m.length !== 10 || p.length !== 6) return;
  const json = JSON.stringify({ mobile: m, pin: p });
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key: STORAGE_KEY, value: json });
    }
  } catch {
    /* still persist web */
  }
  localStorage.setItem(STORAGE_KEY, json);
}

export async function clearGuardianSavedCredentials(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.remove({ key: STORAGE_KEY });
    }
  } catch {
    /* ignore */
  }
  localStorage.removeItem(STORAGE_KEY);
}
