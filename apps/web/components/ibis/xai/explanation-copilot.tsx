"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDownIcon, MessageCircleIcon, SendIcon, SparklesIcon, XIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Message, MessageContent } from "@/components/ui/custom/prompt/message";
import { Markdown } from "@/components/ui/custom/prompt/markdown";
import { TypingLoader } from "@/components/ui/custom/prompt/loader";
import { Textarea } from "@/components/ui/textarea";
import { IbisBlocks } from "@/components/ibis/xai/ibis-blocks";
import { useAvatarUrl, userInitials } from "@/components/ibis/use-avatar";
import {
  askChatQuestion,
  createChatSession,
  getSuggestedQuestions,
  listChatMessages
} from "@/lib/api/generated";
import type {
  ChatMessageRead,
  ChatSessionRead,
  ExplanationResults,
  XaiAudience
} from "@/lib/api/generated";
import { useAuthStore } from "@/lib/auth/store";
import { getBlocks } from "@/lib/xai/blocks";
import { cn } from "@/lib/utils";

// Repli markdown (messages anciens / sans blocs) — compact, cohérent avec le reste du chat.
const CHAT_PROSE = cn(
  "text-sm leading-relaxed [&>*:first-child]:mt-0",
  "[&_p]:mb-2 [&_p:last-child]:mb-0",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-0.5",
  "[&_strong]:font-semibold [&_a]:text-primary [&_a]:underline",
  "[&_code]:text-xs"
);

function AssistantAvatar() {
  return (
    <div className="bg-ai/15 text-ai flex size-8 shrink-0 items-center justify-center rounded-full">
      <SparklesIcon className="size-4" />
    </div>
  );
}

/**
 * Copilote d'explication (CDC copilote §3) — dock bas ouvrable/fermable, à la place de
 * l'encart latéral étroit. Colonne de lecture large, saisie multi-lignes, réponses riches
 * en blocs (IbisBlocks). Non-modal en desktop (on garde l'explication visible), plein écran
 * en mobile. État ouvert/fermé mémorisé par expérimentation.
 */
export function ExplanationCopilot({ explanation }: { explanation: ExplanationResults }) {
  const t = useTranslations("xai");
  const locale = useLocale();
  const user = useAuthStore((state) => state.user);
  const avatarUrl = useAvatarUrl();
  const userInitialsValue = user ? userInitials(user.pseudo, user.email) : "";

  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<ChatSessionRead | null>(null);
  const [messages, setMessages] = useState<ChatMessageRead[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [waiting, setWaiting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const storageKey = `ibis:copilot-open:${explanation.experiment_id}`;

  // Restaure l'état ouvert/fermé (par expérimentation) au montage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOpen(window.localStorage.getItem(storageKey) === "open");
  }, [storageKey]);

  const toggle = (next: boolean) => {
    setOpen(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, next ? "open" : "closed");
    }
  };

  // Nouvelle explication = nouveau contexte → on repart d'une session vierge.
  useEffect(() => {
    setSession(null);
    setMessages([]);
    setQuestion("");
    setWaiting(false);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [explanation.id]);

  // Suggestions contextuelles (déterministes, pas de LLM), au NIVEAU de l'explication commentée
  // (adaptatif §5.2) : le novice se voit proposer des questions en langage courant.
  const audienceLevel = explanation.audience_level as XaiAudience;
  useEffect(() => {
    getSuggestedQuestions({
      path: { experiment_id: explanation.experiment_id },
      query: { language: locale as "fr" | "en", audience: audienceLevel },
      throwOnError: false
    }).then(({ data }) => setSuggestions(data ?? []));
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [explanation.experiment_id, locale, audienceLevel]);

  const refreshMessages = useCallback(async (sessionId: string) => {
    const { data } = await listChatMessages({
      path: { session_id: sessionId },
      throwOnError: false
    });
    if (!data) return;
    setMessages(data);
    if (data.length > 0 && data[data.length - 1].role === "assistant") {
      setWaiting(false);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, []);

  const ensureSession = useCallback(async (): Promise<ChatSessionRead | null> => {
    if (session) return session;
    const { data } = await createChatSession({
      path: { explanation_id: explanation.id },
      body: { language: locale as "fr" | "en" },
      throwOnError: false
    });
    if (data) setSession(data);
    return data ?? null;
  }, [session, explanation.id, locale]);

  // Ouvrir le dock prépare la session (input + suggestions prêts immédiatement).
  useEffect(() => {
    if (open && !session) void ensureSession();
  }, [open, session, ensureSession]);

  // Auto-défilement vers le bas à chaque nouveau message.
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, waiting, open]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || waiting) return;
    const active = await ensureSession();
    if (!active) return;
    setQuestion("");
    setWaiting(true);
    const { data, response } = await askChatQuestion({
      path: { session_id: active.id },
      body: { question: trimmed },
      throwOnError: false
    });
    if (!response?.ok) {
      setWaiting(false);
      return;
    }
    if (data) setSession(data);
    await refreshMessages(active.id);
    pollRef.current = setInterval(() => void refreshMessages(active.id), 1500);
  };

  const remaining = session ? session.max_questions - session.questions_count : 5;
  const canAsk = !session || (remaining > 0 && session.is_active);

  // ---------------------------------------------------------------- Lanceur (état fermé)
  if (!open) {
    return (
      <div className="fixed right-5 bottom-5 z-40 print:hidden">
        <Button
          onClick={() => toggle(true)}
          aria-label={t("copilot.open")}
          className="bg-ai text-ai-foreground hover:bg-ai/90 h-12 gap-2 rounded-full pr-4 pl-3.5 shadow-lg">
          <SparklesIcon className="size-5" />
          <span className="font-medium">{t("copilot.launcher")}</span>
          {session ? (
            <Badge
              variant="secondary"
              className="bg-ai-foreground/20 text-ai-foreground border-0 text-[10px]">
              {t("chat.remaining", { count: Math.max(0, remaining) })}
            </Badge>
          ) : null}
        </Button>
      </div>
    );
  }

  const isLocal = explanation.type === "local";
  const instanceIndex = (explanation.instance_ref as { index?: number } | null)?.index ?? 0;
  const about = isLocal
    ? t("copilot.aboutLocal", { index: instanceIndex })
    : t("copilot.aboutGlobal");

  // ---------------------------------------------------------------- Dock (état ouvert)
  return (
    <div
      role="dialog"
      aria-label={t("copilot.title")}
      onKeyDown={(event) => {
        if (event.key === "Escape") toggle(false);
      }}
      className={cn(
        "bg-background z-40 flex flex-col border shadow-2xl print:hidden",
        // Mobile : feuille plein écran. Desktop : dock flottant bas-droite (non-modal).
        "fixed inset-0 rounded-none",
        "sm:inset-auto sm:right-5 sm:bottom-5 sm:h-[min(72vh,640px)] sm:w-[min(760px,calc(100vw-2.5rem))] sm:rounded-2xl"
      )}>
      {/* En-tête */}
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-ai/15 text-ai flex size-8 shrink-0 items-center justify-center rounded-lg">
            <SparklesIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{t("copilot.title")}</p>
            <p className="text-muted-foreground truncate text-xs">{about}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {session ? (
            <Badge variant={remaining > 0 ? "outline" : "destructive"} className="whitespace-nowrap">
              {t("chat.remaining", { count: Math.max(0, remaining) })}
            </Badge>
          ) : null}
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("copilot.minimize")}
            onClick={() => toggle(false)}>
            <ChevronDownIcon className="hidden sm:block" />
            <XIcon className="sm:hidden" />
          </Button>
        </div>
      </header>

      {/* Zone messages — colonne de lecture centrée et large (confort). */}
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="border-ai/30 bg-ai/5 flex gap-3 rounded-lg border p-4">
                <span className="bg-ai/15 text-ai flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <MessageCircleIcon className="size-4.5" />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{t("copilot.introTitle")}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {t("copilot.introBody")}
                  </p>
                </div>
              </div>
              {suggestions.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs">{t("chat.suggested")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        disabled={waiting}
                        className="hover:border-ai/40 hover:bg-ai/5 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
                        onClick={() => void send(suggestion)}>
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {messages.map((message) => {
            const isUser = message.role === "user";
            const blocks = isUser ? [] : getBlocks(message.blocks);
            return (
              <Message
                key={message.id}
                className={cn("gap-2.5", isUser ? "justify-end" : "items-start justify-start")}>
                {!isUser ? <AssistantAvatar /> : null}
                <div className={cn("flex min-w-0 flex-col gap-1", isUser ? "items-end" : "flex-1")}>
                  {isUser ? (
                    <MessageContent className="bg-primary text-primary-foreground max-w-[85%] px-3.5 py-2 text-sm whitespace-pre-line">
                      {message.content}
                    </MessageContent>
                  ) : (
                    <div className="bg-muted/50 min-w-0 rounded-lg border px-4 py-3">
                      {blocks.length > 0 ? (
                        <IbisBlocks blocks={blocks} />
                      ) : (
                        <Markdown className={CHAT_PROSE}>{message.content}</Markdown>
                      )}
                    </div>
                  )}
                  {!isUser && message.is_fallback ? (
                    <p className="text-muted-foreground px-1 text-[10px]">{t("chat.fallbackNote")}</p>
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
            <Message className="items-start gap-2.5">
              <AssistantAvatar />
              <div className="bg-muted/50 flex items-center gap-2 rounded-lg border px-4 py-3">
                <TypingLoader size="sm" />
                <span className="text-muted-foreground text-xs">{t("chat.waiting")}</span>
              </div>
            </Message>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Saisie multi-lignes */}
      <div className="border-t px-4 py-3">
        <div className="mx-auto max-w-3xl">
          {canAsk ? (
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void send(question);
              }}>
              <Textarea
                value={question}
                maxLength={500}
                rows={1}
                placeholder={t("copilot.placeholder")}
                disabled={waiting}
                className="max-h-32 min-h-[2.75rem] resize-none"
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(question);
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                className="size-11 shrink-0"
                aria-label={t("chat.send")}
                disabled={waiting || !question.trim()}>
                <SendIcon />
              </Button>
            </form>
          ) : (
            <p className="text-muted-foreground py-2 text-center text-sm">{t("chat.expired")}</p>
          )}
          <p className="text-muted-foreground mt-1.5 px-1 text-[11px]">{t("copilot.hint")}</p>
        </div>
      </div>
    </div>
  );
}
