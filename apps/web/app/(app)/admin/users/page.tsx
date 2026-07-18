"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CreditCardIcon,
  PowerIcon,
  PowerOffIcon,
  Trash2Icon,
  UsersIcon
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
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
import { AdminEmptyState } from "@/components/ibis/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/ibis/admin/admin-page-header";
import { AdminSearchInput } from "@/components/ibis/admin/admin-search-input";
import { RowActionsMenu, type RowAction } from "@/components/ibis/admin/row-actions-menu";
import {
  adminDeleteUser,
  adminListUsers,
  adminUpdateUser,
  type UserPage,
  type UserRead,
  type UserRole
} from "@/lib/api/generated";
import { useAuthStore } from "@/lib/auth/store";

const ROLES: UserRole[] = ["user", "contributor", "admin"];

function errorCodeOf(error: unknown): string {
  return (error as { detail?: { code?: string } } | undefined)?.detail?.code ?? "UNKNOWN_ERROR";
}

export default function AdminUsersPage() {
  const t = useTranslations("admin.users");
  const tCommon = useTranslations("admin.common");
  const locale = useLocale();
  const me = useAuthStore((state) => state.user);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UserPage | null>(null);
  const [creditsTarget, setCreditsTarget] = useState<UserRead | null>(null);
  const [creditsAmount, setCreditsAmount] = useState("50");
  const [deleteTarget, setDeleteTarget] = useState<UserRead | null>(null);

  const load = useCallback(async () => {
    const { data: result } = await adminListUsers({
      query: { q: search.trim() || undefined, page, page_size: 20 },
      throwOnError: false
    });
    if (result) setData(result);
  }, [search, page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250); // recherche débouncée
    return () => clearTimeout(timer);
  }, [load]);

  const update = async (user: UserRead, body: Record<string, unknown>) => {
    const { data: updated, error } = await adminUpdateUser({
      path: { user_id: user.id },
      body,
      throwOnError: false
    });
    if (error || !updated) {
      toast.error(errorCodeOf(error) === "LAST_ADMIN" ? t("lastAdmin") : t("error"));
      return;
    }
    toast.success(t("updated"));
    void load();
  };

  const removeUser = async (user: UserRead) => {
    const { error, response } = await adminDeleteUser({
      path: { user_id: user.id },
      throwOnError: false
    });
    if (error || !response?.ok) {
      toast.error(errorCodeOf(error) === "LAST_ADMIN" ? t("lastAdmin") : t("error"));
      return;
    }
    toast.success(t("deleted"));
    void load();
  };

  const actionsFor = (user: UserRead): RowAction[] => [
    {
      key: "credits",
      label: t("addCredits"),
      icon: CreditCardIcon,
      onSelect: () => {
        setCreditsAmount("50");
        setCreditsTarget(user);
      }
    },
    {
      key: "toggle",
      label: user.is_active ? t("deactivate") : t("activate"),
      icon: user.is_active ? PowerOffIcon : PowerIcon,
      onSelect: () => void update(user, { is_active: !user.is_active })
    },
    {
      key: "delete",
      label: t("delete"),
      icon: Trash2Icon,
      variant: "destructive",
      separatorBefore: true,
      onSelect: () => setDeleteTarget(user)
    }
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={UsersIcon}
        title={t("title")}
        count={data?.total}
        subtitle={t("subtitle")}
      />

      <AdminSearchInput
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder={t("search")}
      />

      {data === null ? (
        <Skeleton className="h-64 w-full" />
      ) : data.items.length === 0 ? (
        <AdminEmptyState icon={UsersIcon} title={t("empty")} />
      ) : (
        <Card className="py-0">
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.user")}</TableHead>
                  <TableHead>{t("table.role")}</TableHead>
                  <TableHead>{t("table.status")}</TableHead>
                  <TableHead className="text-right">{t("table.credits")}</TableHead>
                  <TableHead>{t("table.created")}</TableHead>
                  <TableHead className="text-right">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">
                        {user.pseudo ?? "—"}
                        {me?.id === user.id ? (
                          <span className="text-muted-foreground ml-1 text-xs">
                            ({t("you")})
                          </span>
                        ) : null}
                      </div>
                      <div className="text-muted-foreground text-xs">{user.email}</div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(role) => void update(user, { role })}>
                        <SelectTrigger className="w-40" size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {t(`roles.${role}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "destructive"}>
                        {user.is_active ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {user.credits}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(user.created_at).toLocaleDateString(locale)}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActionsMenu actions={actionsFor(user)} label={tCommon("rowActions")} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data && data.total_pages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <span className="text-muted-foreground text-sm">
            {t("pagination", { page: data.page, total: data.total_pages })}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}>
            <ChevronLeftIcon />
            {t("previous")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= data.total_pages}
            onClick={() => setPage((current) => current + 1)}>
            {t("next")}
            <ChevronRightIcon />
          </Button>
        </div>
      ) : null}

      <Dialog
        open={creditsTarget !== null}
        onOpenChange={(open) => !open && setCreditsTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("addCredits")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="credits-amount">{t("creditsAmount")}</Label>
            <Input
              id="credits-amount"
              type="number"
              min={1}
              max={1000}
              value={creditsAmount}
              onChange={(event) => setCreditsAmount(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">{creditsTarget?.email}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditsTarget(null)}>
              {t("cancel")}
            </Button>
            <Button
              disabled={!Number.isInteger(Number(creditsAmount)) || Number(creditsAmount) < 1}
              onClick={() => {
                if (creditsTarget) {
                  void update(creditsTarget, { add_credits: Number(creditsAmount) });
                }
                setCreditsTarget(null);
              }}>
              {t("confirmCredits")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteBody", { email: deleteTarget?.email ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) void removeUser(deleteTarget);
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
