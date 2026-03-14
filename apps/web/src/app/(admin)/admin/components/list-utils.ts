/**
 * Shared pagination types and helpers for admin list views (agents, users).
 */

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  total: number;
  limit: number;
}

const MAX_VISIBLE_PAGES = 5;

/**
 * Returns page numbers and "ellipsis" placeholders for pagination UI.
 */
export function getPageNumbers(
  pagination: PaginationInfo,
): Array<number | "ellipsis"> {
  const pages: Array<number | "ellipsis"> = [];
  const { currentPage, totalPages } = pagination;

  if (totalPages <= MAX_VISIBLE_PAGES) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }

  if (currentPage <= 3) {
    for (let i = 1; i <= 4; i++) pages.push(i);
    pages.push("ellipsis");
    pages.push(totalPages);
  } else if (currentPage >= totalPages - 2) {
    pages.push(1);
    pages.push("ellipsis");
    for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    pages.push("ellipsis");
    for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
    pages.push("ellipsis");
    pages.push(totalPages);
  }

  return pages;
}

export function getPaginationRange(pagination: PaginationInfo): {
  startIndex: number;
  endIndex: number;
} {
  const { total, currentPage, limit } = pagination;
  const startIndex = total > 0 ? (currentPage - 1) * limit + 1 : 0;
  const endIndex = Math.min(currentPage * limit, total);
  return { startIndex, endIndex };
}
