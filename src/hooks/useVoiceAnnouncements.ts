import { useCallback } from "react";

interface VoiceSettings {
  enabled: boolean;
  voice: "male" | "female";
  speed: number;
  language: string;
}

function pickVoice(lang: string, pref: "male" | "female"): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const byLang = voices.filter((v) => v.lang?.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)));
  const pool = byLang.length ? byLang : voices;
  const genderHint = pref === "female" ? /female|zira|susan|siri/i : /male|david|mark|alex/i;
  return pool.find((v) => genderHint.test(v.name)) || pool[0] || null;
}

function speakBrowser(text: string, opts?: { rate?: number; lang?: string; voice?: "male" | "female" }) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  if (!text?.trim()) return;
  window.speechSynthesis.cancel(); // keep only latest announcement
  const u = new SpeechSynthesisUtterance(text);
  u.lang = opts?.lang || "en-IN";
  u.rate = opts?.rate ?? 1;
  const selected = pickVoice(u.lang, opts?.voice ?? "female");
  if (selected) u.voice = selected;
  window.speechSynthesis.speak(u);
}

export function useVoiceAnnouncements() {
  const appLang =
    typeof window !== "undefined" && localStorage.getItem("app_lang") === "bn" ? "bn-IN" : "en-IN";
  const defaultSettings: VoiceSettings = {
    enabled: true,
    voice: "female",
    speed: 1.0,
    language: appLang,
  };

  const getSettings = useCallback((): VoiceSettings => {
    try {
      const saved = localStorage.getItem("voiceSettings");
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  }, []);

  const saveSettings = useCallback(
    (settings: Partial<VoiceSettings>) => {
      try {
        const current = getSettings();
        localStorage.setItem("voiceSettings", JSON.stringify({ ...current, ...settings }));
      } catch (e) {
        console.warn("Failed to save voice settings:", e);
      }
    },
    [getSettings],
  );

  const speak = useCallback(
    async (text: string, options?: Partial<VoiceSettings>) => {
      const settings = getSettings();
      if (!settings.enabled) return;
      speakBrowser(text, {
        rate: options?.speed ?? settings.speed,
        lang: options?.language ?? settings.language,
        voice: options?.voice ?? settings.voice,
      });
    },
    [getSettings],
  );

  const announceStudentPickup = useCallback(
    async (studentName: string, busNumber: string) => {
      const settings = getSettings();
      if (!settings.enabled) return;
      speakBrowser(`Pickup: ${studentName} for bus ${busNumber}.`, {
        lang: settings.language,
        rate: settings.speed,
        voice: settings.voice,
      });
    },
    [getSettings],
  );

  const announceStudentDropoff = useCallback(
    async (studentName: string) => {
      const settings = getSettings();
      if (!settings.enabled) return;
      speakBrowser(`Drop-off completed for ${studentName}.`, {
        lang: settings.language,
        rate: settings.speed,
        voice: settings.voice,
      });
    },
    [getSettings],
  );

  const announceEmergency = useCallback(
    async (busNumber: string) => {
      const settings = getSettings();
      if (!settings.enabled) return;
      speakBrowser(`Emergency alert for bus ${busNumber}.`, {
        lang: settings.language,
        rate: settings.speed,
        voice: settings.voice,
      });
    },
    [getSettings],
  );

  const announceBusArrival = useCallback(
    async (busNumber: string, eta: string) => {
      const settings = getSettings();
      if (!settings.enabled) return;
      const line =
        settings.language === "bn-IN"
          ? `বাস ${busNumber} আসতে সম্ভাব্য সময় ${eta}। প্রস্তুত থাকুন।`
          : `Bus ${busNumber} estimated arrival ${eta}.`;
      speakBrowser(line, {
        lang: settings.language,
        rate: settings.speed,
        voice: settings.voice,
      });
    },
    [getSettings],
  );

  const announceRouteStart = useCallback(
    async (busNumber: string, routeName: string) => {
      await speak(
        `Bus ${busNumber} is starting route ${routeName}. Students, please be ready at pickup points.`,
      );
    },
    [speak],
  );

  const announceRouteComplete = useCallback(
    async (busNumber: string) => {
      await speak(`Bus ${busNumber} has completed its route.`);
    },
    [speak],
  );

  const announceSpeedAlert = useCallback(
    async (currentSpeed: number, speedLimit: number) => {
      await speak(
        `Speed alert: ${currentSpeed} kilometers per hour exceeds limit ${speedLimit}. Please slow down.`,
        { speed: 0.85 },
      );
    },
    [speak],
  );

  const announceGeofenceAlert = useCallback(
    async (busNumber: string, location: string) => {
      await speak(`Bus ${busNumber} left the designated area near ${location}.`);
    },
    [speak],
  );

  return {
    speak,
    announceStudentPickup,
    announceStudentDropoff,
    announceEmergency,
    announceBusArrival,
    announceRouteStart,
    announceRouteComplete,
    announceSpeedAlert,
    announceGeofenceAlert,
    getSettings,
    saveSettings,
  };
}
