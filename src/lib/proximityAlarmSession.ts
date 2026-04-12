import { isNativeAndroidApp } from "@/lib/nativeAndroidApp";

const DEFAULT_DURATION_MS = 2 * 60 * 1000;

let activeAbort: AbortController | null = null;
/** Browser `setInterval` returns `number`; Node typings use `Timeout` — use number for client code. */
let vibInterval: number | null = null;
let sirenInterval: number | null = null;

function stopVibrationLoop() {
  if (vibInterval) {
    clearInterval(vibInterval);
    vibInterval = null;
  }
}

function stopSirenLoop() {
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }
}

export function stopProximityAlarmSession(): void {
  activeAbort?.abort();
  activeAbort = null;
  stopVibrationLoop();
  stopSirenLoop();
}

/**
 * Loud repeating alarm + strong vibration for guardians (e.g. bus approaching).
 * Stops any previous session. Runs up to `durationMs` (default 2 minutes).
 */
export function startProximityAlarmSession(durationMs = DEFAULT_DURATION_MS): void {
  stopProximityAlarmSession();
  const ac = new AbortController();
  activeAbort = ac;
  const signal = ac.signal;
  const endAt = Date.now() + durationMs;

  const vibratePulse = async () => {
    if (Date.now() >= endAt || signal.aborted) return;
    try {
      if (isNativeAndroidApp()) {
        const { Haptics } = await import("@capacitor/haptics");
        await Haptics.vibrate({ duration: 1000 });
      } else if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.([
          400, 150, 500, 150, 400,
        ]);
      }
    } catch {
      /* ignore */
    }
  };

  void vibratePulse();
  vibInterval = window.setInterval(() => {
    if (Date.now() >= endAt || signal.aborted) {
      stopVibrationLoop();
      return;
    }
    void vibratePulse();
  }, 1600);

  void runSirenLoop(endAt, signal);

  window.setTimeout(() => {
    if (!signal.aborted) stopProximityAlarmSession();
  }, durationMs + 500);
}

async function runSirenLoop(endAt: number, signal: AbortSignal): Promise<void> {
  if (typeof window === "undefined") return;
  const ACtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!ACtx) return;

  let ctx: AudioContext | null = new ACtx();
  try {
    if (ctx.state === "suspended") await ctx.resume();
  } catch {
    /* ignore */
  }

  let flip = false;
  const tick = () => {
    if (!ctx || Date.now() >= endAt || signal.aborted) {
      stopSirenLoop();
      try {
        ctx?.close();
      } catch {
        /* ignore */
      }
      ctx = null;
      return;
    }
    flip = !flip;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = flip ? 920 : 680;
      gain.gain.value = 0.5;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      window.setTimeout(() => {
        try {
          osc.stop();
          osc.disconnect();
          gain.disconnect();
        } catch {
          /* ignore */
        }
      }, 280);
    } catch {
      /* ignore */
    }
  };

  tick();
  sirenInterval = window.setInterval(tick, 340);

  signal.addEventListener(
    "abort",
    () => {
      stopSirenLoop();
      try {
        ctx?.close();
      } catch {
        /* ignore */
      }
      ctx = null;
    },
    { once: true },
  );
}
