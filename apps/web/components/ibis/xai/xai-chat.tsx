"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MessageCircleIcon, SendIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  askChatQuestion,
  createChatSession,
  getSuggestedQuestions,
  listChatMessages
} from "@/lib/api/generated";
import type { ChatMessageRead, ChatSessionRead, ExplanationResults } from "@/lib/api/generated";

/** Chat XAI (CDC §9.6) : 5 questions max, asynchrone (polling 1,5 s), fallback badgé. */
export function XaiChat({ explanation }: { explanation: ExplanationResults }) {
  const t = useTranslations("xai.chat");
  const locale = useLocale();
  const [session, setSession] = useState<ChatSessionRead | null>(null);
  const [messages, setMessages] = useState<ChatMessageRead[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [waiting, setWaiting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getSuggestedQuestions({
      path: { experiment_id: explanation.experiment_id },
      query: { language: locale as "fr" | "en" },
      throwOnError: false
    }).then(({ data }) => setSuggestions(data ?? []));
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [explanation.experiment_id, locale]);

  const refreshMessages = useCallback(
    async (sessionId: string) => {
      const { data } = await listChatMessages({
        path: { session_id: sessionId },
        throwOnError: false
      });
      if (!data) return;
      setMessages(data);
      // La réponse est arrivée quand le dernier message vient de l'assistant
      if (data.length > 0 && data[data.length - 1].role === "assistant") {
        setWaiting(false);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    },
    []
  );

  const start = async () => {
    const { data } = await createChatSession({
      path: { explanation_id: explanation.id },
      body: { language: locale as "fr" | "en" },
      throwOnError: false
    });
    if (data) setSession(data);
  };

  const send = async (text: string) => {
    if (!session || !text.trim() || waiting) return;
    setQuestion("");
    setWaiting(true);
    const { data, response } = await askChatQuestion({
      path: { session_id: session.id },
      body: { question: text.trim() },
      throwOnError: false
    });
    if (!response?.ok) {
      setWaiting(false);
      return;
    }
    if (data) setSession(data);
    await refreshMessages(session.id);
    // Réponse asynchrone : repli polling 1,5 s (ADR-007)
    pollRef.current = setInterval(() => void refreshMessages(session.id), 1500);
  };

  if (!session) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <p className="text-sm font-medium">{t("title")}</p>
          <Button variant="outline" onClick={() => void start()}>
            <MessageCircleIcon />
            {t("start")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const remaining = session.max_questions - session.questions_count;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          {t("title")}
          <Badge variant={remaining > 0 ? "outline" : "destructive"}>
            {t("remaining", { count: Math.max(0, remaining) })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {messages.length === 0 && suggestions.length > 0 ? (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">{t("suggested")}</p>
            <div className="flex flex-wrap gap-1">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="hover:bg-muted rounded-full border px-2.5 py-1 text-xs"
                  onClick={() => void send(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="max-h-80 space-y-2 overflow-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground ml-auto"
                  : "bg-muted"
              }`}>
              <p className="whitespace-pre-line">{message.content}</p>
              {message.role === "assistant" && message.is_fallback ? (
                <p className="mt-1 text-[10px] opacity-70">{t("fallbackNote")}</p>
              ) : null}
            </div>
          ))}
          {waiting ? <p className="text-muted-foreground text-xs">{t("waiting")}</p> : null}
        </div>

        {remaining > 0 && session.is_active ? (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void send(question);
            }}>
            <Input
              value={question}
              maxLength={500}
              placeholder={t("placeholder")}
              onChange={(event) => setQuestion(event.target.value)}
              disabled={waiting}
            />
            <Button
              type="submit"
              size="icon"
              aria-label={t("send")}
              disabled={waiting || !question.trim()}>
              <SendIcon />
            </Button>
          </form>
        ) : !session.is_active ? (
          <p className="text-muted-foreground text-xs">{t("expired")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
