"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
          <h2 className="text-2xl font-semibold">Something went wrong</h2>
          <p className="mt-2 text-sm text-slate-300">
            The error has been logged. Please try again.
          </p>
          <button
            className="mt-5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            onClick={() => reset()}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

