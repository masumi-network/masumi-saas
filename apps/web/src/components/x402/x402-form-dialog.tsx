"use client";

import type { FormEvent, ReactNode } from "react";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const X402_DIALOG_CONTENT_CLASS =
  "flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0";

export const X402_DIALOG_CLOSE_CLASS = "top-8 right-4 -translate-y-1/2";

export { X402DialogChrome };

type DialogChromeProps = {
  open: boolean;
  onClose: () => void;
  maxWidthClassName?: string;
  showCloseButton?: boolean;
  onInteractOutside?: (event: Event) => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
};

function X402DialogChrome({
  open,
  onClose,
  maxWidthClassName = "sm:max-w-lg",
  showCloseButton = true,
  onInteractOutside,
  onEscapeKeyDown,
  children,
}: DialogChromeProps & { children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        className={cn(X402_DIALOG_CONTENT_CLASS, maxWidthClassName)}
        closeButtonClassName={X402_DIALOG_CLOSE_CLASS}
        showCloseButton={showCloseButton}
        onInteractOutside={onInteractOutside}
        onEscapeKeyDown={onEscapeKeyDown}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function X402DialogHeader({
  title,
  description,
}: {
  title: string;
  description?: ReactNode;
}) {
  return (
    <div className="shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12">
      <DialogHeader className="text-left">
        <DialogTitle>{title}</DialogTitle>
        {description ? (
          typeof description === "string" ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <div className="text-sm text-muted-foreground">{description}</div>
          )
        ) : null}
      </DialogHeader>
    </div>
  );
}

type X402FormDialogProps = DialogChromeProps & {
  title: string;
  description?: ReactNode;
  onSubmit: (event: FormEvent) => void;
  bodyClassName?: string;
  footer: ReactNode;
  children: ReactNode;
};

export function X402FormDialog({
  open,
  onClose,
  title,
  description,
  maxWidthClassName,
  showCloseButton,
  onInteractOutside,
  onEscapeKeyDown,
  onSubmit,
  bodyClassName,
  footer,
  children,
}: X402FormDialogProps) {
  return (
    <X402DialogChrome
      open={open}
      onClose={onClose}
      maxWidthClassName={maxWidthClassName}
      showCloseButton={showCloseButton}
      onInteractOutside={onInteractOutside}
      onEscapeKeyDown={onEscapeKeyDown}
    >
      <form
        onSubmit={onSubmit}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <X402DialogHeader title={title} description={description} />
        <DialogBody
          stagger={false}
          className={cn(
            "min-h-0 flex-1 space-y-4 overflow-y-auto",
            bodyClassName,
          )}
        >
          {children}
        </DialogBody>
        <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
          {footer}
        </DialogFooter>
      </form>
    </X402DialogChrome>
  );
}

type X402ViewDialogProps = DialogChromeProps & {
  title: string;
  description?: ReactNode;
  bodyClassName?: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function X402ViewDialog({
  open,
  onClose,
  title,
  description,
  maxWidthClassName,
  showCloseButton,
  onInteractOutside,
  onEscapeKeyDown,
  bodyClassName,
  footer,
  children,
}: X402ViewDialogProps) {
  return (
    <X402DialogChrome
      open={open}
      onClose={onClose}
      maxWidthClassName={maxWidthClassName}
      showCloseButton={showCloseButton}
      onInteractOutside={onInteractOutside}
      onEscapeKeyDown={onEscapeKeyDown}
    >
      <X402DialogHeader title={title} description={description} />
      <DialogBody
        stagger={false}
        className={cn(
          "min-h-0 flex-1 space-y-4 overflow-y-auto",
          bodyClassName,
        )}
      >
        {children}
      </DialogBody>
      {footer ? (
        <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
          {footer}
        </DialogFooter>
      ) : null}
    </X402DialogChrome>
  );
}
