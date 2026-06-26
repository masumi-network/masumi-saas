"use client";

import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const x402ActionsHeadClass =
  "text-right sticky right-0 z-10 w-48 min-w-48 bg-gradient-to-r from-transparent via-background/80 to-background";

export const x402ActionsCellClass =
  "text-right sticky right-0 z-10 w-48 min-w-48 bg-gradient-to-r from-transparent via-background/80 to-background pointer-events-none [&>*]:pointer-events-auto";

export const x402ActionsHeadWideClass =
  "text-right sticky right-0 z-10 w-64 min-w-64 bg-gradient-to-r from-transparent via-background/80 to-background";

export const x402ActionsCellWideClass =
  "text-right sticky right-0 z-10 w-64 min-w-64 bg-gradient-to-r from-transparent via-background/80 to-background pointer-events-none [&>*]:pointer-events-auto";

export function X402TableEmptyState({
  icon: Icon,
  message,
}: {
  icon: LucideIcon;
  message: string;
}) {
  return (
    <div className="rounded-xl border border-dashed px-6 py-14 text-center">
      <div className="mx-auto max-w-md space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-base font-medium">{message}</p>
      </div>
    </div>
  );
}

export function X402TableSkeleton({
  columns = 5,
  rows = 5,
  withActions = true,
  wideActions = false,
}: {
  columns?: number;
  rows?: number;
  withActions?: boolean;
  wideActions?: boolean;
}) {
  const actionsHeadClass = wideActions
    ? x402ActionsHeadWideClass
    : x402ActionsHeadClass;
  const actionsCellClass = wideActions
    ? x402ActionsCellWideClass
    : x402ActionsCellClass;

  const renderCell = (index: number) => {
    switch (index % 4) {
      case 0:
        return (
          <div className="space-y-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        );
      case 1:
        return <Skeleton className="h-5 w-16 rounded-full" />;
      case 2:
        return (
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24 shrink-0 font-mono" />
            <Skeleton className="h-7 w-7 shrink-0 rounded" />
          </div>
        );
      default:
        return <Skeleton className="h-4 w-20" />;
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border/80">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: columns }, (_, index) => (
              <TableHead key={index}>
                <Skeleton className="h-4 w-16" />
              </TableHead>
            ))}
            {withActions ? (
              <TableHead className={actionsHeadClass}>
                <Skeleton className="ml-auto h-4 w-14" />
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columns }, (_, colIndex) => (
                <TableCell key={colIndex}>
                  {renderCell(rowIndex + colIndex)}
                </TableCell>
              ))}
              {withActions ? (
                <TableCell className={actionsCellClass}>
                  <div className="flex justify-end gap-1">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                    {wideActions ? (
                      <Skeleton className="h-8 w-8 rounded" />
                    ) : null}
                  </div>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function X402TableLoading({
  columns,
  rows,
  withActions,
  wideActions,
}: {
  columns?: number;
  rows?: number;
  withActions?: boolean;
  wideActions?: boolean;
} = {}) {
  return (
    <X402TableSkeleton
      columns={columns}
      rows={rows}
      withActions={withActions}
      wideActions={wideActions}
    />
  );
}

export function X402TableSearch({
  value,
  onChange,
  placeholder,
  shortcutLabel,
  inputRef,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  shortcutLabel?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div
      onClick={() => inputRef?.current?.focus()}
      className={cn(
        "relative flex min-w-0 flex-1 cursor-text items-center gap-2 rounded-lg border border-border/80 bg-muted-surface/60 px-3 py-2.5 text-sm ring-offset-background transition-colors focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 md:max-w-md lg:max-w-sm",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="h-6 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
      />
      {shortcutLabel && !isFocused ? (
        <kbd className="pointer-events-none hidden h-6 shrink-0 items-center justify-center rounded-md border bg-muted px-2 font-mono text-xs text-foreground sm:inline-flex">
          {shortcutLabel}
        </kbd>
      ) : null}
    </div>
  );
}
