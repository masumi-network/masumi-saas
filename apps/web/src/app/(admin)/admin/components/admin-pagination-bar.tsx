"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import { getPageNumbers, type PaginationInfo } from "./list-utils";

export interface AdminPaginationBarLabels {
  previous: string;
  next: string;
  previousAriaLabel: string;
  nextAriaLabel: string;
  ellipsisSrText: string;
}

interface AdminPaginationBarProps {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  labels: AdminPaginationBarLabels;
}

export function AdminPaginationBar({
  pagination,
  onPageChange,
  labels,
}: AdminPaginationBarProps) {
  const pages = getPageNumbers(pagination);
  const { previous, next, previousAriaLabel, nextAriaLabel, ellipsisSrText } =
    labels;

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            text={previous}
            ariaLabel={previousAriaLabel}
            onClick={() => onPageChange(pagination.currentPage - 1)}
            aria-disabled={pagination.currentPage === 1}
            className={
              pagination.currentPage === 1
                ? "pointer-events-none opacity-50"
                : ""
            }
          />
        </PaginationItem>
        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <PaginationEllipsis srText={ellipsisSrText} />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink
                onClick={() => onPageChange(p)}
                isActive={pagination.currentPage === p}
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            text={next}
            ariaLabel={nextAriaLabel}
            onClick={() => onPageChange(pagination.currentPage + 1)}
            aria-disabled={pagination.currentPage === pagination.totalPages}
            className={
              pagination.currentPage === pagination.totalPages
                ? "pointer-events-none opacity-50"
                : ""
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
