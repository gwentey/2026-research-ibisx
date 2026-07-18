"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MessageCircleIcon, SendIcon, SparklesIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Message, MessageContent } from "@/components/ui/custom/prompt/message";
import { TypingLoader } from "@/components/ui/custom/prompt/loader";
import { Input } from "@/components/ui/input";
import { useAvatarUrl, userInitials } from "@/components/ibis/use-avatar";
import {
  askChatQuestion,
  createChatSession,
  getSuggestedQuestions,
  listChatMessages
} from "@/lib/api/generated";
import type { ChatMessageRead, ChatSessionRead, ExplanationResults } from "@/lib/api/generated";
import { useAuthStore } from "@/lib/auth/store";
import { cn } from "@/lib/utils";

/** Avatar assistant : icône sur pastille tonale (chart-1) — jamais de couleur inventée. */
function AssistantAvatar() {
  return (
    <div className="bg-chart-1/15 text-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
      <SparklesIcon className="size-4" />
    </div>
  );
}

/** Chat XAI (CDC §9.6) : 5 questions max, asynchrone (polling 1,5 s), fallback badgé. */
export function XaiChat({ explanation }: { explanation: ExplanationResults }) {
  const t = useTranslations("xai.chat");
  const locale = useLocale();
  const user = useAuthStore((state) => state.user);
  const avatarUrl = useAvatarUrl();
  const [session, setSession] = useState<ChatSessionRead | null>(null);
  const [messages, setMessages] = useState<ChatMessageRead[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [waiting, setWaiting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userInitialsValue = user ? userInitials(user.pseudo, user.email) : "";

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
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div className="flex items-center gap-3">
            <div className="bg-chart-1/10 text-foreground flex size-10 shrink-0 items-center justify-center rounded-full">
              <SparklesIcon className="size-4" />
            </div>
            <p className="text-sm font-medium">{t("title")}</p>
          </div>
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

        <div className="max-h-80 space-y-3 overflow-auto pr-1">
          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <Message
                key={message.id}
                className={cn("items-end gap-2", isUser ? "justify-end" : "justify-start")}>
                {!isUser ? <AssistantAvatar /> : null}
                <div className={cn("flex max-w-[85%] flex-col gap-1", isUser && "items-end")}>
                  <MessageContent
                    className={cn(
                      "px-3 py-2 text-sm whitespace-pre-line",
                      isUser ? "bg-primary text-primary-foreground" : "bg-muted border"
                    )}>
                    {message.content}
                  </MessageContent>
                  {!isUser && message.is_fallback ? (
                    <p className="text-muted-foreground px-1 text-[10px]">{t("fallbackNote")}</p>
                  ) : null}
                </div>
                {isUser ? (
                  <Avatar className="size-8 shrink-0">
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt={userInitialsValue} /> : null}
                    <AvatarFallback>{userInitialsValue}</AvatarFallback>
                  </Avatar>
                ) : null}
              </Message>
            );
          })}
          {waiting ? (
            <Message className="items-end gap-2">
              <AssistantAvatar />
              <div className="bg-muted flex items-center gap-2 rounded-lg border px-3 py-2">
                <TypingLoader size="sm" />
                <span className="text-muted-foreground text-xs">{t("waiting")}</span>
              </div>
            </Message>
          ) : null}
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
