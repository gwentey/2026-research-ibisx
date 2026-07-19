"use client";

import { Fragment } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  InfoIcon,
  type LucideIcon,
  SparklesIcon,
  TrendingDownIcon,
  TrendingUpIcon
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  type Block,
  normalizeTone,
  parseInline,
  TONE_DOT,
  TONE_SURFACE,
  TONE_TEXT,
  type Tone
} from "@/lib/xai/blocks";
import { humanizeFeature } from "@/lib/xai/features";
import { cn } from "@/lib/utils";

// Rendu du contrat de blocs XAI v2 (CDC copilote §5). Chaque bloc → un composant du kit ;
// les tonalités passent par les maps de tokens (lib/xai/blocks). AUCUN HTML arbitraire :
// le texte inline est tokenisé puis rendu en éléments React (sûr par construction).

/** Texte inline riche : **gras**, *italique*, `code`, ==surligné== (accent IA). */
function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((token, index) => {
        switch (token.kind) {
          case "bold":
            return (
              <strong key={index} className="font-semibold">
                {token.value}
              </strong>
            );
          case "italic":
            return <em key={index}>{token.value}</em>;
          case "code":
            return (
              <code
                key={index}
                className="bg-background rounded-sm px-1 font-mono text-[0.85em]">
                {token.value}
              </code>
            );
          case "highlight":
            return (
              <mark key={index} className="bg-ai/15 text-ai rounded px-1 font-medium">
                {token.value}
              </mark>
            );
          default:
            return <Fragment key={index}>{token.value}</Fragment>;
        }
      })}
    </>
  );
}

const CALLOUT_ICON: Record<Tone, LucideIcon> = {
  neutral: InfoIcon,
  accent: SparklesIcon,
  positive: CheckCircle2Icon,
  negative: AlertTriangleIcon,
  warning: AlertTriangleIcon
};

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className="text-sm leading-relaxed">
          <Inline text={block.text} />
        </p>
      );

    case "heading": {
      const Tag = block.level === 4 ? "h5" : "h4";
      return <Tag className="text-sm font-semibold">{block.text}</Tag>;
    }

    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List
          className={cn(
            "space-y-0.5 pl-5 text-sm leading-relaxed",
            block.ordered ? "list-decimal" : "list-disc"
          )}>
          {block.items.map((item, index) => (
            <li key={index}>
              <Inline text={item} />
            </li>
          ))}
        </List>
      );
    }

    case "table":
      return (
        <div className="overflow-x-auto rounded-md border">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                {block.columns.map((col, index) => (
                  <TableHead key={index} className="h-8 px-2">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {block.rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {row.map((cell, cellIndex) => {
                    const tone = normalizeTone(cell.tone);
                    return (
                      <TableCell
                        key={cellIndex}
                        className={cn("px-2 py-1.5", TONE_TEXT[tone], tone !== "neutral" && "font-medium")}>
                        {tone !== "neutral" ? (
                          <span
                            className={cn("mr-1.5 inline-block size-1.5 rounded-full align-middle", TONE_DOT[tone])}
                            aria-hidden
                          />
                        ) : null}
                        <Inline text={cell.text} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );

    case "callout": {
      const tone = normalizeTone(block.tone);
      const Icon = CALLOUT_ICON[tone];
      return (
        <div className={cn("flex gap-2.5 rounded-lg border p-3", TONE_SURFACE[tone])}>
          <Icon className={cn("mt-0.5 size-4 shrink-0", TONE_TEXT[tone] || "text-muted-foreground")} />
          <div className="min-w-0 space-y-0.5">
            {block.title ? (
              <p className={cn("text-sm font-semibold", TONE_TEXT[tone])}>{block.title}</p>
            ) : null}
            <p className="text-muted-foreground text-sm leading-relaxed">
              <Inline text={block.text} />
            </p>
          </div>
        </div>
      );
    }

    case "keyValue":
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {block.items.map((item, index) => {
            const tone = normalizeTone(item.tone);
            return (
              <div key={index} className="bg-muted/40 space-y-0.5 rounded-md border p-2">
                <p className="text-muted-foreground text-xs leading-tight">{item.label}</p>
                <p className={cn("text-sm font-semibold", TONE_TEXT[tone])}>{item.value}</p>
              </div>
            );
          })}
        </div>
      );

    case "featureImpact": {
      const max = Math.max(...block.items.map((item) => Math.abs(item.weight)), 1e-9);
      return (
        <div className="space-y-1.5">
          {block.items.map((item, index) => {
            const up = item.direction !== "down";
            const pct = Math.min(100, (Math.abs(item.weight) / max) * 100);
            return (
              <div key={index} className="flex items-center gap-2 text-xs">
                {/* Humanisation au rendu : normalise aussi les anciens messages (noms bruts). */}
                <span className="w-28 shrink-0 truncate" title={humanizeFeature(item.feature)}>
                  {humanizeFeature(item.feature)}
                </span>
                <div className="bg-muted h-2 flex-1 overflow-hidden rounded">
                  <div
                    className={cn("h-2 rounded", up ? "bg-green-600/80 dark:bg-green-400/80" : "bg-red-600/80 dark:bg-red-400/80")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {up ? (
                  <TrendingUpIcon className="size-3.5 shrink-0 text-green-600 dark:text-green-400" />
                ) : (
                  <TrendingDownIcon className="size-3.5 shrink-0 text-red-600 dark:text-red-400" />
                )}
              </div>
            );
          })}
        </div>
      );
    }

    default:
      // Type inconnu (contrat futur / message ancien) → dégradé texte, jamais de crash.
      return (
        <p className="text-muted-foreground text-sm">{JSON.stringify(block)}</p>
      );
  }
}

/** Rend un document de blocs. Renvoie null si la liste est vide (l'appelant gère le repli). */
export function IbisBlocks({ blocks, className }: { blocks: Block[]; className?: string }) {
  if (blocks.length === 0) return null;
  return (
    <div className={cn("space-y-3", className)}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}
