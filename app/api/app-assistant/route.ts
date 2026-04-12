import { NextResponse } from "next/server";
import {
  getRequestIp,
  isAllowedAssistantOrigin,
  rateLimitAssistant,
} from "@/lib/server/appAssistantGuard";

export const runtime = "nodejs";

const STATIC_HELP = `You are viewing **Safe Route** (school bus tracking).

**Parents (guardians)**  
- Sign in with the **10-digit mobile** and **6-digit PIN** from your school.  
- Open **Live map / ETA** to see the bus when the driver has started a trip.  
- **Pickup & drop history** shows when your child was marked on or off the bus.  
- **Quiet hours** in Notification settings reduce night-time pushes (you can still open the app).  
- If the bus is late, the driver may send a **delay notice** — check notifications.

**Drivers**  
- **Start trip** to share live location with parents and admin.  
- Use the **student checklist** to log pickup/drop (this feeds guardian history).  
- **Quick message** goes to the school admin; **Running late** notifies parents on your route.  
- **Emergency** button is for real emergencies only.

**Admins**  
- **Trip history** = trip sessions; **Pickup & drop** = per-student driver check-ins.  
- **Operational alerts** show open panic alerts and buses with stale GPS.

**Problems**  
- Wrong PIN: use **Forgot PIN** or contact the school. After many wrong tries, login pauses briefly for security.  
- Map empty: driver must **start a trip** and allow **location/GPS** (HTTPS on mobile browsers).

For school-specific rules (fees, routes, contact persons), ask your school office — this app only handles bus tracking and related notices.`;

const SYSTEM_PROMPT = `You help users of the Safe Route school bus app (India). Be concise, friendly, and practical. 
Do not give medical or legal advice. If unsure, tell them to contact their school administrator.
Context: guardians track buses live; drivers log student pickup/drop and share location during trips; admins manage data.
Never invent school-specific facts (fees, phone numbers).`;

function buildMessages(userMessage: string, history: { role: string; content: string }[]) {
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...history.slice(-8).map((m) => ({
      role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: String(m.content).slice(0, 4000),
    })),
    { role: "user" as const, content: userMessage.slice(0, 4000) },
  ];
}

async function chatCompletion(
  url: string,
  apiKey: string,
  model: string,
  extraHeaders: Record<string, string>,
  userMessage: string,
  history: { role: string; content: string }[],
  logLabel: string,
): Promise<string | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 700,
      messages: buildMessages(userMessage, history),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[app-assistant] ${logLabel} error:`, res.status, errText.slice(0, 500));
    return null;
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  return text || null;
}

async function openRouterReply(userMessage: string, history: { role: string; content: string }[]) {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return null;

  const model =
    process.env.OPENROUTER_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "openai/gpt-4o-mini";

  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";
  const title = process.env.OPENROUTER_APP_NAME?.trim() || "Safe Route";

  return chatCompletion(
    "https://openrouter.ai/api/v1/chat/completions",
    key,
    model,
    {
      "HTTP-Referer": referer,
      "X-Title": title,
    },
    userMessage,
    history,
    "OpenRouter",
  );
}

async function openAiReply(userMessage: string, history: { role: string; content: string }[]) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  return chatCompletion(
    "https://api.openai.com/v1/chat/completions",
    key,
    model,
    {},
    userMessage,
    history,
    "OpenAI",
  );
}

export async function POST(req: Request) {
  try {
    if (!isAllowedAssistantOrigin(req)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ip = getRequestIp(req);
    const limited = rateLimitAssistant(ip);
    if (limited.ok === false) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        },
      );
    }

    const body = (await req.json()) as { message?: string; history?: { role: string; content: string }[] };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    const history = Array.isArray(body.history) ? body.history : [];

    const viaRouter = await openRouterReply(message, history);
    if (viaRouter) {
      return NextResponse.json({ reply: viaRouter, mode: "openrouter" });
    }

    const viaOpenAi = await openAiReply(message, history);
    if (viaOpenAi) {
      return NextResponse.json({ reply: viaOpenAi, mode: "openai" });
    }

    return NextResponse.json({
      reply: `${STATIC_HELP}\n\n---\n*Tip: Add \`OPENROUTER_API_KEY\` or \`OPENAI_API_KEY\` on the server for smarter, conversational answers.*\n\n**Your question (summary):** ${message.slice(0, 200)}`,
      mode: "static",
    });
  } catch (e) {
    console.error("[app-assistant]", e);
    return NextResponse.json({ error: "Assistant unavailable" }, { status: 500 });
  }
}
