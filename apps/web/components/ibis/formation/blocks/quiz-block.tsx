"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, HelpCircleIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// B5 — Quiz éclair. Une question, des options, et surtout une EXPLICATION (pas un simple
// vrai/faux). On peut réessayer librement (on oriente, on ne sanctionne pas). Prévient la leçon
// quand la bonne réponse est trouvée (onCorrect) pour débloquer la fin de leçon.
export function QuizBlock({
  lessonSlug,
  blockId,
  answer,
  onCorrect
}: {
  lessonSlug: string;
  blockId: string;
  answer: number;
  onCorrect: () => void;
}) {
  const t = useTranslations("formation");
  const base = `lessons.${lessonSlug}.${blockId}`;
  const options = t.raw(`${base}.options`) as string[];

  const [picked, setPicked] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);

  function choose(index: number) {
    if (solved) return;
    setPicked(index);
    if (index === answer) {
      setSolved(true);
      onCorrect();
    }
  }

  return (
    <div className="bg-card space-y-3 rounded-xl border p-4">
      <p className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
        <HelpCircleIcon className="size-3.5" />
        {t("blocks.quizLabel")}
      </p>
      <p className="font-medium">{t(`${base}.question`)}</p>

      <div className="space-y-2" role="radiogroup" aria-label={t(`${base}.question`)}>
        {options.map((option, index) => {
          const isPicked = picked === index;
          const isRight = index === answer;
          const revealRight = isPicked && isRight;
          const revealWrong = isPicked && !isRight;
          return (
            <button
              key={index}
              type="button"
              role="radio"
              aria-checked={isPicked}
              disabled={solved}
              onClick={() => choose(index)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                "hover:bg-muted/50 disabled:cursor-default",
                revealRight && "border-score-5 bg-score-5/15",
                revealWrong && "border-destructive/40 bg-destructive/5"
              )}>
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
                  revealRight && "border-score-5 text-score-5",
                  revealWrong && "border-destructive text-destructive"
                )}>
                {revealRight ? (
                  <CheckIcon className="size-3.5" />
                ) : revealWrong ? (
                  <XIcon className="size-3.5" />
                ) : (
                  String.fromCharCode(65 + index)
                )}
              </span>
              <span className="flex-1">{option}</span>
            </button>
          );
        })}
      </div>

      {picked !== null ? (
        <p
          className={cn(
            "rounded-lg border px-3 py-2.5 text-sm leading-relaxed",
            solved ? "border-score-5/40 bg-score-5/10" : "bg-muted/40"
          )}>
          <span className="font-medium">
            {solved ? t("blocks.quizCorrect") : t("blocks.quizRetry")}{" "}
          </span>
          {t(`${base}.explanation`)}
        </p>
      ) : null}
    </div>
  );
}
