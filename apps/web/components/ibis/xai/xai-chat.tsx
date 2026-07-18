"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MessageCircleIcon, SendIcon, SparklesIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Message, MessageContent } from "@/components/ui/custom/prompt/message";
import { Markdown } from "@/components/ui/custom/prompt/markdown";
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

// Style markdown compact pour les bulles assistant (pas de plugin prose → sélecteurs utilitaires).
const CHAT_PROSE = cn(
  "text-sm leading-relaxed [&>*:first-child]:mt-0",
  "[&_p]:mb-2 [&_p:last-child]:mb-0",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-0.5",
  "[&_strong]:font-semibold [&_a]:text-primary [&_a]:underline",
  "[&_h1]:mt-2 [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-medium",
  "[&_code]:text-xs",
  "[&_table]:my-2 [&_table]:w-full [&_table]:text-xs [&_th]:border [&_th]:px-1.5 [&_th]:py-0.5 [&_th]:text-left [&_td]:border [&_td]:px-1.5 [&_td]:py-0.5"
);

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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircleIcon className="text-muted-foreground size-4" />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <div className="bg-chart-1/10 text-foreground flex size-12 shrink-0 items-center justify-center rounded-full">
            <SparklesIcon className="size-5" />
          </div>
          <Button variant="outline" className="w-full" onClick={() => void start()}>
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
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex min-w-0 items-center gap-2">
            <MessageCircleIcon className="text-muted-foreground size-4 shrink-0" />
            <span className="truncate">{t("title")}</span>
          </span>
          <Badge
            variant={remaining > 0 ? "outline" : "destructive"}
            className="shrink-0 whitespace-nowrap">
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
                  {isUser ? (
                    <MessageContent className="bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-line">
                      {message.content}
                    </MessageContent>
                  ) : (
                    <div className="bg-muted min-w-0 rounded-lg border px-3 py-2 break-words">
                      <Markdown className={CHAT_PROSE}>{message.content}</Markdown>
                    </div>
                  )}
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
