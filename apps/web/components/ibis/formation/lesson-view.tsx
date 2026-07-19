"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MythBlock } from "@/components/ibis/formation/blocks/myth-block";
import { VisualBlock } from "@/components/ibis/formation/blocks/visual-block";
import { NotionCardBlock } from "@/components/ibis/formation/blocks/notion-card-block";
import { QuizBlock } from "@/components/ibis/formation/blocks/quiz-block";
import { PracticeBlock } from "@/components/ibis/formation/blocks/practice-block";
import { cursusLessonSlugs, lessonNotions } from "@/lib/formation/progress";
import { useAcademyStore } from "@/lib/formation/store";
import type { Cursus, Lesson, Module } from "@/lib/formation/types";

// Rendu d'une leçon = la séquence de ses blocs (§3.5). La fin de leçon exige que le quiz soit
// réussi (on peut réessayer sans limite) ; une leçon « mise en pratique » se termine en lançant
// le vrai Défi. Terminer attribue les cartes-notions au deck et enchaîne.
export function LessonView({
  cursus,
  module,
  lesson
}: {
  cursus: Cursus;
  module: Module;
  lesson: Lesson;
}) {
  const t = useTranslations("formation");
  const router = useRouter();
  const completeLesson = useAcademyStore((state) => state.completeLesson);

  const notions = useMemo(() => lessonNotions(lesson), [lesson]);
  const hasQuiz = lesson.blocks.some((b) => b.type === "quiz");
  const hasPractice = lesson.blocks.some((b) => b.type === "practice");
  const [quizSolved, setQuizSolved] = useState(false);

  // Leçon suivante du cursus (dans l'ordre), sinon retour au cursus.
  const nextHref = useMemo(() => {
    const slugs = cursusLessonSlugs(cursus);
    const i = slugs.indexOf(lesson.slug);
    const next = i >= 0 ? slugs[i + 1] : undefined;
    return next ? `/formation/${cursus.slug}/${next}` : `/formation/${cursus.slug}`;
  }, [cursus, lesson.slug]);

  const position = useMemo(() => {
    const slugs = cursusLessonSlugs(cursus);
    return { index: slugs.indexOf(lesson.slug) + 1, total: slugs.length };
  }, [cursus, lesson.slug]);

  function finish() {
    completeLesson(lesson.slug, notions);
    router.push(nextHref);
  }

  const canFinish = !hasQuiz || quizSolved;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground -ml-2">
          <Link href={`/formation/${cursus.slug}`}>
            <ArrowLeftIcon />
            {t(`cursus.${cursus.slug}.title`)}
          </Link>
        </Button>
        <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
          {t(`modules.${module.slug}.title`)} · {t("home.lessonPosition", position)}
        </p>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {t(`lessons.${lesson.slug}.title`)}
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          {t(`lessons.${lesson.slug}.summary`)}
        </p>
      </div>

      <div className="space-y-5">
        {lesson.blocks.map((block, i) => {
          const key = `${block.type}-${i}`;
          switch (block.type) {
            case "myth":
              return <MythBlock key={key} lessonSlug={lesson.slug} blockId={block.id} />;
            case "visual":
              return (
                <VisualBlock
                  key={key}
                  lessonSlug={lesson.slug}
                  blockId={block.id}
                  domain={cursus.domain}
                />
              );
            case "notion":
              return <NotionCardBlock key={key} notionId={block.notion!} />;
            case "quiz":
              return (
                <QuizBlock
                  key={key}
                  lessonSlug={lesson.slug}
                  blockId={block.id}
                  answer={block.answer!}
                  onCorrect={() => setQuizSolved(true)}
                />
              );
            case "practice":
              return (
                <PracticeBlock
                  key={key}
                  lessonSlug={lesson.slug}
                  blockId={block.id}
                  challengeSlug={block.challenge!}
                  onStart={() => completeLesson(lesson.slug, notions)}
                />
              );
            default:
              return null;
          }
        })}
      </div>

      {/* Pied de leçon — masqué pour les leçons « mise en pratique » (le Défi conclut). */}
      {hasPractice ? null : (
        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <p className="text-muted-foreground text-xs">
            {canFinish ? t("blocks.readyToFinish") : t("blocks.answerToFinish")}
          </p>
          <Button onClick={finish} disabled={!canFinish}>
            <CheckCircle2Icon />
            {t("blocks.finishLesson")}
            <ArrowRightIcon />
          </Button>
        </div>
      )}
    </div>
  );
}
