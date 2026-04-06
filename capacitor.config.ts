import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Hosted on Vercel — Android WebView loads the same site as the browser (data stays in sync).
 *
 * - Production URL: `CAPACITOR_SERVER_URL` or https://saferoute.sishutirtha.co.in
 * - LAN dev: `CAPACITOR_LIVE_RELOAD_URL=http://YOUR_LAN_IP:8080` (cleartext) then `npm run cap:sync:android`
 */
const productionUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  "https://saferoute.sishutirtha.co.in";

const liveReloadUrl = process.env.CAPACITOR_LIVE_RELOAD_URL?.trim();

const config: CapacitorConfig = {
  appId: "in.sishutirtha.saferoute",
  appName: "Safe Route",
  webDir: "out",
  server: liveReloadUrl
    ? {
        url: liveReloadUrl.replace(/\/$/, ""),
        cleartext: true,
      }
    : {
        url: productionUrl.replace(/\/$/, ""),
        cleartext: false,
        androidScheme: "https",
      },
  plugins: {
    Camera: {
      permissions: ["camera", "photos"],
    },
    Geolocation: {
      permissions: ["location"],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#0f172a",
      androidSplashResourceName: "splash",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      overlaysWebView: false,
    },
  },
  android: {
    backgroundColor: "#0f172a",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "CAMERA",
      "POST_NOTIFICATIONS",
    ],
  },
};

export default config;