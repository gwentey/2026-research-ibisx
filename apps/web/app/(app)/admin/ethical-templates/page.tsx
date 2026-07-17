"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  adminDeleteTemplate,
  adminListTemplates,
  adminUpsertTemplate,
  type TemplateRead
} from "@/lib/api/generated";
import { ETHICAL_KEYS, type EthicalKey } from "@/lib/datasets/constants";

type Tristate = "true" | "false" | "unset";

function toTristate(value: unknown): Tristate {
  if (value === true) return "true";
  if (value === false) return "false";
  return "unset";
}

export default function AdminEthicalTemplatesPage() {
  const t = useTranslations("admin.templates");
  const tEthics = useTranslations("datasets.ethics");
  const locale = useLocale();
  const [templates, setTemplates] = useState<TemplateRead[] | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [editing, setEditing] = useState<{ domain: string; values: Record<EthicalKey, Tristate> } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await adminListTemplates({ throwOnError: false });
    if (data) setTemplates(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEditor = (domain: string, defaults: Record<string, unknown>) => {
    const values = Object.fromEntries(
      ETHICAL_KEYS.map((key) => [key, toTristate(defaults[key])])
    ) as Record<EthicalKey, Tristate>;
    setEditing({ domain: domain.trim().toLowerCase(), values });
  };

  const save = async () => {
    if (!editing) return;
    const defaults: Record<string, boolean> = {};
    for (const key of ETHICAL_KEYS) {
      const value = editing.values[key];
      if (value !== "unset") defaults[key] = value === "true";
    }
    const { error } = await adminUpsertTemplate({
      path: { domain: editing.domain },
      body: { defaults },
      throwOnError: false
    });
    if (error) {
      toast.error(t("error"));
      return;
    }
    toast.success(t("saved"));
    setEditing(null);
    setNewDomain("");
    void load();
  };

  const remove = async (domain: string) => {
    const { response } = await adminDeleteTemplate({
      path: { domain },
      throwOnError: false
    });
    if (!response?.ok) {
      toast.error(t("error"));
      return;
    }
    toast.success(t("deleted"));
    void load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <div className="flex max-w-md gap-2">
        <Input
          value={newDomain}
          onChange={(event) => setNewDomain(event.target.value)}
          placeholder={t("newDomain")}
        />
        <Button
          disabled={!newDomain.trim()}
          onClick={() => {
            const existing = templates?.find(
              (candidate) => candidate.domain === newDomain.trim().toLowerCase()
            );
            openEditor(newDomain, existing?.defaults ?? {});
          }}>
          {t("create")}
        </Button>
      </div>

      {templates === null ? (
        <Skeleton className="h-48 w-full" />
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.domain")}</TableHead>
                  <TableHead>{t("table.defined")}</TableHead>
                  <TableHead>{t("table.updated")}</TableHead>
                  <TableHead className="text-right">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">
                      <Badge variant="outline">{template.domain}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {t("definedCount", {
                        count: Object.keys(template.defaults).length
                      })}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(template.updated_at).toLocaleString(locale)}
                    </TableCell>
                    <TableCell className="space-x-2 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditor(template.domain, template.defaults)}>
                        {t("edit")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteTarget(template.domain)}>
                        {t("delete")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle", { domain: editing?.domain ?? "" })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {ETHICAL_KEYS.map((key) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <span className="text-sm">{tEthics(key)}</span>
                <Select
                  value={editing?.values[key] ?? "unset"}
                  onValueChange={(value) =>
                    setEditing((current) =>
                      current
                        ? { ...current, values: { ...current.values, [key]: value as Tristate } }
                        : current
                    )
                  }>
                  <SelectTrigger className="w-40" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">{t("unset")}</SelectItem>
                    <SelectItem value="true">{t("yes")}</SelectItem>
                    <SelectItem value="false">{t("no")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t("cancel")}
            </Button>
            <Button onClick={() => void save()}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle", { domain: deleteTarget ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) void remove(deleteTarget);
                setDeleteTarget(null);
              }}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
