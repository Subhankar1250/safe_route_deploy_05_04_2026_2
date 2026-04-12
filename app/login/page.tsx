"use client";

import type { CSSProperties } from "react";
import { Suspense } from "react";
import Login from "@/components/auth/Login";

const shell: CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  padding: "1.5rem",
  paddingTop: "max(1.5rem, env(safe-area-inset-top, 0px))",
  paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  background: "linear-gradient(165deg, #020617 0%, #0f172a 38%, #134e4a 72%, #14532d 100%)",
  color: "rgba(226, 232, 240, 0.95)",
  fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
};

const loadingText: CSSProperties = {
  margin: 0,
  fontSize: "0.875rem",
};

function LoginSuspenseFallback() {
  return (
    <div style={shell}>
      <p style={loadingText}>Loading sign-in…</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSuspenseFallback />}>
      <Login />
    </Suspense>
  );
}
