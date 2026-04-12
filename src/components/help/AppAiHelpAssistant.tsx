"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Loader2, MessageCircleQuestion, Send } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

type Props = {
  /** e.g. "Login" | "Guardian" */
  contextLabel?: string;
};

export function AppAiHelpAssistant({ contextLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi — ask how to use Safe Route (login, map, notifications, driver checklist, or admin tools). I’ll give short steps.",
    },
  ]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch("/api/app-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: next.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply ?? "No answer returned.",
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            e instanceof Error
              ? `Sorry — ${e.message}`
              : "Sorry, something went wrong. Try again or contact your school.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-xl">
          <MessageCircleQuestion className="h-4 w-4" />
          Help {contextLabel ? `(${contextLabel})` : ""}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[min(85vh,640px)] flex flex-col">
        <SheetHeader className="text-left">
          <SheetTitle>Safe Route assistant</SheetTitle>
          <SheetDescription>
            Answers about this app. Not for emergencies — use the driver SOS or call local emergency numbers.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border bg-muted/20 p-3 text-sm">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-6 rounded-lg bg-primary/10 px-3 py-2 text-foreground"
                    : "mr-4 rounded-lg bg-background px-3 py-2 text-muted-foreground"
                }
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking…
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Why is the map empty?"
              value={input}
              disabled={loading}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button type="button" size="icon" disabled={loading || !input.trim()} onClick={() => void send()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
