import Link from "next/link";
import { getMessages, getTranslations } from "next-intl/server";
import { ArrowLeftIcon } from "lucide-react";

import Logo from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LanguageSwitcher } from "@/components/ibis/language-switcher";
import type { LegalSection } from "@/lib/legal/documents";

// Coquille commune aux documents légaux (/legal/privacy, /legal/terms). Publique :
// aucun garde d'authentification — Google exige que les liens de l'écran de consentement
// OAuth soient atteignables sans compte. Grammaire de la landing (header sticky, max-w,
// wash chart-2 léger) + sommaire ancré en vis-à-vis sur desktop, comme une leçon de
// l'académie : un document long doit rester navigable, pas être un mur de texte.

type LegalDocumentProps = {
  /** Espace de traduction du document, ex. "legal.privacy". */
  namespace: string;
  sections: LegalSection[];
  /** Document jumeau, affiché en pied de page. */
  sibling: { href: string; labelKey: string };
};

export async function LegalDocument({ namespace, sections, sibling }: LegalDocumentProps) {
  const t = await getTranslations(namespace);
  const tLegal = await getTranslations("legal");
  const tCommon = await getTranslations("common");

  // Les listes `items` sont facultatives (certaines sections sont un seul paragraphe).
  // On lit le catalogue directement plutôt que `t.raw`, qui journalise un MISSING_MESSAGE
  // pour chaque section sans liste — du bruit d'erreur en SSR pour un cas nominal.
  const messages = (await getMessages()) as Record<string, unknown>;
  const document = namespace
    .split(".")
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], messages);
  const catalogSections = (
    document as { sections?: Record<string, { items?: unknown }> } | undefined
  )?.sections;

  return (
    <main className="bg-background min-h-screen">
      <header className="bg-background/95 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
            <span className="font-semibold">{tCommon("appName")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="ghost" asChild>
              <Link href="/">
                <ArrowLeftIcon />
                {tLegal("backHome")}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="bg-chart-2/10 dark:bg-chart-2/20 pointer-events-none absolute inset-x-0 top-0 -z-10 h-[320px] [mask-image:radial-gradient(ellipse_65%_60%_at_50%_0%,black,transparent_75%)]"
        />
        <div className="mx-auto max-w-3xl px-6 pt-14 pb-8">
          <Badge variant="outline" className="gap-1.5 py-1.5">
            {tLegal("badge")}
          </Badge>
          <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
          <p className="text-muted-foreground mt-4 text-base">{t("intro")}</p>
          <p className="text-muted-foreground mt-4 text-xs">
            {tLegal("updatedAt", { date: tLegal("lastUpdate") })}
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-10 px-6 pb-20 lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav aria-label={tLegal("summary")} className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {tLegal("summary")}
            </p>
            <ul className="mt-3 space-y-1.5">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-muted-foreground hover:text-foreground block text-sm transition-colors">
                    <span className="tabular-nums">{index + 1}.</span>{" "}
                    {t(`sections.${section.id}.title` as never)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <article className="max-w-2xl space-y-10">
          {sections.map(({ id, icon: Icon }, index) => {
            const raw = catalogSections?.[id]?.items;
            const items = Array.isArray(raw) ? (raw as string[]) : [];

            return (
              <section key={id} id={id} className="scroll-mt-24">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 text-primary mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="size-4.5" />
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    <span className="text-muted-foreground mr-1.5 tabular-nums">{index + 1}.</span>
                    {t(`sections.${id}.title` as never)}
                  </h2>
                </div>
                <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                  {t(`sections.${id}.body` as never)}
                </p>
                {items.length > 0 ? (
                  <ul className="mt-4 space-y-2">
                    {items.map((item, itemIndex) => (
                      <li
                        key={itemIndex}
                        className="text-muted-foreground border-primary/30 border-l-2 py-0.5 pl-4 text-sm leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}

          <Separator />

          <footer className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {tLegal("contact")}{" "}
              <a href={`mailto:${tLegal("contactEmail")}`} className="text-foreground underline">
                {tLegal("contactEmail")}
              </a>
            </p>
            <Button variant="outline" asChild>
              <Link href={sibling.href}>{tLegal(sibling.labelKey as never)}</Link>
            </Button>
          </footer>
        </article>
      </div>
    </main>
  );
}
