"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon, ArrowRightIcon, BookOpenIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { glossaryEntries } from "@/lib/formation/glossary";

// Glossaire vivant (O4) : tous les termes de l'académie, cherchables, chacun relié à sa leçon.
export default function GlossaryPage() {
  const t = useTranslations("formation");
  const [query, setQuery] = useState("");

  const items = useMemo(
    () =>
      glossaryEntries().map((entry) => ({
        entry,
        term: t(`notions.${entry.notionId}.term`),
        definition: t(`notions.${entry.notionId}.definition`),
        example: t(`notions.${entry.notionId}.example`)
      })),
    [t]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.term.toLowerCase().includes(q) || item.definition.toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="text-muted-foreground -ml-2">
        <Link href="/formation">
          <ArrowLeftIcon />
          {t("home.backToAcademy")}
        </Link>
      </Button>

      <div className="space-y-3">
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
            <BookOpenIcon className="size-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {t("glossary.title")}
            </h1>
            <p className="text-muted-foreground text-sm">{t("glossary.subtitle")}</p>
          </div>
        </div>
        <div className="relative">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("glossary.searchPlaceholder")}
            className="pl-9"
            aria-label={t("glossary.searchPlaceholder")}
          />
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        {t("glossary.count", { count: filtered.length })}
      </p>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">{t("glossary.empty")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(({ entry, term, definition, example }) => (
            <Card key={entry.notionId} className="gap-0">
              <CardContent className="space-y-1.5">
                <h2 className="font-semibold">{term}</h2>
                <p className="text-sm leading-relaxed">{definition}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  <span className="text-foreground/70 font-medium">
                    {t("blocks.notionExample")}{" "}
                  </span>
                  {example}
                </p>
                <Link
                  href={`/formation/${entry.cursusSlug}/${entry.lessonSlug}`}
                  className="text-primary inline-flex items-center gap-1 pt-1 text-xs font-medium hover:underline">
                  {t("glossary.learnMore")}
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
