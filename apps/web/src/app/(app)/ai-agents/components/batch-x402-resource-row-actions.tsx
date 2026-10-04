"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { BatchX402RowMetadata } from "@/lib/x402/batch-x402-row-metadata";

type BatchX402ResourceRowActionsProps = {
  rowId: string;
  disabled?: boolean;
  metadata?: BatchX402RowMetadata;
  canEdit?: boolean;
  labels: {
    actions: string;
    edit: string;
    delete: string;
    editTitle: string;
    name: string;
    description: string;
    tags: string;
    save: string;
    cancel: string;
  };
  onDelete: () => void;
  onSaveMetadata: (metadata: BatchX402RowMetadata) => void;
};

export function BatchX402ResourceRowActions({
  rowId,
  disabled,
  metadata,
  canEdit = true,
  labels,
  onDelete,
  onSaveMetadata,
}: BatchX402ResourceRowActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const pendingEditOpenRef = useRef(false);
  const [draft, setDraft] = useState<BatchX402RowMetadata>({
    name: "",
    description: "",
    tagsText: "",
  });

  const editEnabled = canEdit && metadata != null;

  const scheduleEditPopoverOpen = () => {
    if (!metadata) return;
    setDraft(metadata);
    setMenuOpen(false);
    pendingEditOpenRef.current = true;
    window.setTimeout(() => {
      pendingEditOpenRef.current = false;
      setEditOpen(true);
    }, 0);
  };

  return (
    <Popover open={editOpen} onOpenChange={setEditOpen} modal>
      <PopoverAnchor asChild>
        <div className="relative inline-flex shrink-0">
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                disabled={disabled}
                aria-label={labels.actions}
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[9rem]"
              onCloseAutoFocus={(event) => {
                if (pendingEditOpenRef.current || editOpen) {
                  event.preventDefault();
                }
              }}
            >
              {editEnabled ? (
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    scheduleEditPopoverOpen();
                  }}
                >
                  <Pencil className="mr-2 size-4 shrink-0" aria-hidden />
                  {labels.edit}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                variant="destructive"
                onSelect={(event) => {
                  event.preventDefault();
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                <Trash2 className="mr-2 size-4 shrink-0" aria-hidden />
                {labels.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PopoverAnchor>

      {editEnabled ? (
        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={6}
          className="z-[100] w-[min(100vw-2.5rem,22rem)] space-y-3 p-4"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const root = event.currentTarget as HTMLElement | null;
            const input = root?.querySelector<HTMLInputElement>(
              `#batch-row-name-${CSS.escape(rowId)}`,
            );
            input?.focus();
          }}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <p className="text-sm font-medium">{labels.editTitle}</p>
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label htmlFor={`batch-row-name-${rowId}`} className="text-xs">
                {labels.name}
              </Label>
              <Input
                id={`batch-row-name-${rowId}`}
                value={draft.name}
                maxLength={250}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor={`batch-row-description-${rowId}`}
                className="text-xs"
              >
                {labels.description}
              </Label>
              <Textarea
                id={`batch-row-description-${rowId}`}
                value={draft.description}
                maxLength={250}
                rows={3}
                className="min-h-[72px] resize-y text-sm"
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`batch-row-tags-${rowId}`} className="text-xs">
                {labels.tags}
              </Label>
              <Input
                id={`batch-row-tags-${rowId}`}
                value={draft.tagsText}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    tagsText: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(false)}
            >
              {labels.cancel}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                onSaveMetadata({
                  name: draft.name.trim(),
                  description: draft.description.trim(),
                  tagsText: draft.tagsText.trim(),
                });
                setEditOpen(false);
              }}
            >
              {labels.save}
            </Button>
          </div>
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
