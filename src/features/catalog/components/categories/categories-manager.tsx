"use client";

import { FolderTree, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { StateCard } from "@/components/state-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import type { AdminMain, AdminSub, MoveDirection } from "../../category-rules";
import { moveCategory } from "../../server/category-actions";
import { CategoryDialog, type CategoryDialogTarget } from "./category-dialog";
import { DeleteCategoryDialog } from "./delete-category-dialog";

const moveKey = (id: string, direction: MoveDirection) => `${id}:${direction}`;

// The categories page body (spec 0008 AC-1 to AC-5; docs/design/pages/admin-categories.md): one
// card per main, its subs under a line, and the ↑ ↓, edit, add sub, and delete buttons. Buttons
// that cannot act stay focusable with `aria-disabled`, so focus never jumps after a move.
export function CategoriesManager({ mains }: { readonly mains: readonly AdminMain[] }) {
  const t = useTranslations("AdminCategories");
  const router = useRouter();
  const [dialog, setDialog] = useState<CategoryDialogTarget | null>(null);
  const [deleting, setDeleting] = useState<AdminSub | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // After a move the list renders again in its new order; focus goes back to the same button.
  const refocus = useRef<string | null>(null);

  useEffect(() => {
    if (!refocus.current) return;
    const key = refocus.current;
    refocus.current = null;
    document.querySelector<HTMLElement>(`[data-move="${CSS.escape(key)}"]`)?.focus();
  }, [mains]);

  const move = (id: string, direction: MoveDirection) =>
    startTransition(async () => {
      setNotice(null);
      refocus.current = moveKey(id, direction);
      try {
        const result = await moveCategory({ id, direction });
        if (result.ok) return;
        // A stale page: nothing changed; show the current order quietly.
        if (result.error === "at_edge" || result.error === "not_found") router.refresh();
        else setNotice(t(result.error === "forbidden" ? "errors.forbidden" : "errors.move_failed"));
      } catch {
        setNotice(t("errors.move_failed"));
      }
    });

  const addMain = (
    <Button
      onClick={() => setDialog({ kind: "add", parent: null })}
      data-testid="category-add-main"
    >
      {t("addMain")}
    </Button>
  );

  const rowButtons = (category: AdminSub, index: number, count: number) => (
    <>
      <Button
        variant="outline"
        size="icon"
        disabled={index === 0 || pending}
        focusableWhenDisabled
        onClick={() => move(category.id, "up")}
        aria-label={t("moveUpLabel", { name: category.name })}
        data-move={moveKey(category.id, "up")}
      >
        <span aria-hidden>↑</span>
      </Button>
      <Button
        variant="outline"
        size="icon"
        disabled={index === count - 1 || pending}
        focusableWhenDisabled
        onClick={() => move(category.id, "down")}
        aria-label={t("moveDownLabel", { name: category.name })}
        data-move={moveKey(category.id, "down")}
      >
        <span aria-hidden>↓</span>
      </Button>
    </>
  );

  const editButton = (category: AdminSub, parentHidden: boolean, main: AdminMain | null) => (
    <Button
      variant="outline"
      onClick={() =>
        setDialog({
          kind: "edit",
          category,
          parentHidden,
          main: main ? { builtLine: main.builtLine } : null,
        })
      }
      aria-label={t("editLabel", { name: category.name })}
    >
      {t("edit")}
    </Button>
  );

  const deleteButton = (category: AdminSub) => {
    const reasonId = `category-${category.id}-blocked`;
    return (
      <span className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          disabled={!category.canDelete}
          focusableWhenDisabled
          onClick={() => setDeleting(category)}
          aria-label={t("deleteLabel", { name: category.name })}
          aria-describedby={category.canDelete ? undefined : reasonId}
        >
          <Trash2 aria-hidden />
        </Button>
        {category.canDelete ? null : (
          <span id={reasonId} className="type-caption text-muted">
            {t("deleteBlocked")}
          </span>
        )}
      </span>
    );
  };

  const heading = (category: AdminSub, level: "main" | "sub") => (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className={level === "main" ? "type-title-s" : "font-bold"}>{category.name}</span>
      <span className="type-caption text-muted">
        {t("count", { shown: formatNumber(category.productCount) })}
      </span>
      {category.isVisible ? null : <Badge variant="off">{t("hidden")}</Badge>}
    </p>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-display-s">{t("title")}</h1>
        {mains.length ? addMain : null}
      </div>

      {notice ? (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      {mains.length === 0 ? (
        <StateCard
          icon={FolderTree}
          title={t("emptyTitle")}
          text={t("emptyText")}
          actions={addMain}
          className="max-w-(--admin-column-max)"
        />
      ) : (
        <ul
          aria-label={t("listLabel")}
          className="flex max-w-(--admin-column-max) flex-col gap-3"
          data-testid="admin-categories"
        >
          {mains.map((main, mainIndex) => (
            <li key={main.id}>
              <Card data-testid={`category-${main.name}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {heading(main, "main")}
                  <div className="flex flex-wrap items-center gap-2">
                    {rowButtons(main, mainIndex, mains.length)}
                    {editButton(main, false, main)}
                    <Button
                      variant="outline"
                      onClick={() =>
                        setDialog({
                          kind: "add",
                          parent: { id: main.id, name: main.name, isVisible: main.isVisible },
                        })
                      }
                      aria-label={t("addSubLabel", { name: main.name })}
                    >
                      {t("addSub")}
                    </Button>
                    {deleteButton(main)}
                  </div>
                </div>
                {main.subs.length ? (
                  <ul
                    aria-label={t("subListLabel", { name: main.name })}
                    className="flex flex-col border-t border-border"
                  >
                    {main.subs.map((sub, subIndex) => (
                      <li
                        key={sub.id}
                        data-testid={`category-${sub.name}`}
                        className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-2 last:border-b-0"
                      >
                        {heading(sub, "sub")}
                        <div className="flex flex-wrap items-center gap-2">
                          {rowButtons(sub, subIndex, main.subs.length)}
                          {editButton(sub, !main.isVisible, null)}
                          {deleteButton(sub)}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="type-small text-muted">{t("note")}</p>

      <CategoryDialog target={dialog} onClose={() => setDialog(null)} />
      <DeleteCategoryDialog category={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
