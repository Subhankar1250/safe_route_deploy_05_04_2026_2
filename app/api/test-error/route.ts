import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    throw new Error("Sentry server test error");
  } catch (err) {
    Sentry.captureException(err);
  }

  return new Response(JSON.stringify({ ok: true, message: "Captured server test error" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

