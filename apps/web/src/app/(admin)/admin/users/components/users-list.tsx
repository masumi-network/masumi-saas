"use client";

import { Check, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth/auth.client";

interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  kycStatus: string | null;
  role: string;
  banned: boolean;
  banReason: string | null;
  createdAt: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  total: number;
  limit: number;
}

interface UsersListProps {
  currentUserId?: string;
  users: User[];
  pagination: PaginationInfo;
  currentSearch: string;
  currentFilter: string;
}

export default function UsersList({
  currentUserId,
  users,
  pagination,
  currentSearch,
  currentFilter,
}: UsersListProps) {
  const t = useTranslations("Admin.Users");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [unbanDialogOpen, setUnbanDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [banReason, setBanReason] = useState("");
  const [searchInput, setSearchInput] = useState(currentSearch);

  // Debounced search effect
  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== currentSearch) {
        const params = new URLSearchParams(window.location.search);
        if (searchInput) {
          params.set("search", searchInput);
        } else {
          params.delete("search");
        }
        params.set("page", "1");
        startTransition(() => {
          router.push(`?${params.toString()}`);
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, currentSearch, router, startTransition]);

  const updateParams = (newParams: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(newParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const handleFilterChange = (filter: string) => {
    updateParams({ filter: filter === "all" ? "" : filter, page: "1" });
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > pagination.totalPages) return;
    updateParams({ page: String(page) });
  };

  const handleLimitChange = (limit: string) => {
    updateParams({ limit, page: "1" });
  };

  const handleClearSearch = () => {
    setSearchInput("");
    updateParams({ search: "", filter: "", page: "1" });
  };

  const validRoles = ["admin", "user"] as const;
  type ValidRole = (typeof validRoles)[number];

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (userId === currentUserId) {
      toast.error(t("cannotModifySelf"));
      return;
    }

    if (!validRoles.includes(newRole as ValidRole)) return;

    setLoading(userId);
    try {
      const result = await authClient.admin.setRole({
        userId,
        role: newRole as ValidRole,
      });

      if (result.error) {
        toast.error(t("error"));
      } else {
        toast.success(t("roleUpdateSuccess"));
        router.refresh();
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setLoading(null);
    }
  };

  const handleBanClick = (user: User) => {
    if (user.id === currentUserId) {
      toast.error(t("cannotModifySelf"));
      return;
    }

    setSelectedUser(user);
    if (user.banned) {
      setUnbanDialogOpen(true);
    } else {
      setBanReason("");
      setBanDialogOpen(true);
    }
  };

  const handleUnbanConfirm = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    setLoading(selectedUser.id);
    try {
      const result = await authClient.admin.unbanUser({
        userId: selectedUser.id,
      });
      if (result.error) {
        toast.error(t("error"));
      } else {
        toast.success(t("unbanSuccess"));
        setUnbanDialogOpen(false);
        setSelectedUser(null);
        router.refresh();
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setLoading(null);
      setIsSubmitting(false);
    }
  };

  const handleBanConfirm = async () => {
    if (!selectedUser) return;

    const reason = banReason.trim() || t("defaultBanReason");
    setIsSubmitting(true);
    setLoading(selectedUser.id);

    try {
      const result = await authClient.admin.banUser({
        userId: selectedUser.id,
        banReason: reason,
      });
      if (result.error) {
        toast.error(t("error"));
        return; // Keep dialog open so the user can retry or edit the reason
      }
      toast.success(t("banSuccess"));
      setBanDialogOpen(false);
      setSelectedUser(null);
      setBanReason("");
      router.refresh();
    } catch {
      toast.error(t("error"));
      // Keep dialog open on network error
    } finally {
      setLoading(null);
      setIsSubmitting(false);
    }
  };

  const getKycStatusBadge = (status: string | null) => {
    if (!status) {
      return (
        <Badge variant="secondary" className="font-normal">
          {t("kycNone")}
        </Badge>
      );
    }

    const statusMap: Record<
      string,
      { variant: "default" | "secondary" | "destructive"; label: string }
    > = {
      PENDING: { variant: "secondary", label: t("kycPending") },
      APPROVED: { variant: "default", label: t("kycApproved") },
      VERIFIED: { variant: "default", label: t("kycVerified") },
      REJECTED: { variant: "destructive", label: t("kycRejected") },
      REVIEW: { variant: "secondary", label: t("kycReview") },
      REVOKED: { variant: "destructive", label: t("kycRevoked") },
      EXPIRED: { variant: "destructive", label: t("kycExpired") },
    };

    const config = statusMap[status] || {
      variant: "secondary" as const,
      label: status,
    };
    return (
      <Badge variant={config.variant} className="font-normal">
        {config.label}
      </Badge>
    );
  };

  const tabs = [
    { name: t("filterAll"), key: "all" },
    { name: t("filterVerified"), key: "verified" },
    { name: t("filterUnverified"), key: "unverified" },
  ];

  const startIndex =
    pagination.total > 0
      ? (pagination.currentPage - 1) * pagination.limit + 1
      : 0;
  const endIndex = Math.min(
    pagination.currentPage * pagination.limit,
    pagination.total,
  );

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (pagination.totalPages <= maxVisiblePages) {
      for (let i = 1; i <= pagination.totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (pagination.currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(pagination.totalPages);
      } else if (pagination.currentPage >= pagination.totalPages - 2) {
        pages.push(1);
        pages.push("ellipsis");
        for (
          let i = pagination.totalPages - 3;
          i <= pagination.totalPages;
          i++
        ) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("ellipsis");
        for (
          let i = pagination.currentPage - 1;
          i <= pagination.currentPage + 1;
          i++
        ) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(pagination.totalPages);
      }
    }

    return pages;
  };

  const isEmpty =
    users.length === 0 && !currentSearch && currentFilter === "all";
  const isNoResults =
    users.length === 0 && (currentSearch || currentFilter !== "all");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Filter tabs */}
          <Tabs
            tabs={tabs}
            activeTab={currentFilter || "all"}
            onTabChange={handleFilterChange}
          />

          {/* Screen reader announcement for dynamic content changes */}
          <div aria-live="polite" className="sr-only">
            {isPending
              ? t("loading")
              : !isEmpty && !isNoResults
                ? t("showingRange", {
                    start: startIndex,
                    end: endIndex,
                    total: pagination.total,
                  })
                : ""}
          </div>

          {/* Table with loading overlay */}
          <div className={isPending ? "opacity-50 pointer-events-none" : ""}>
            {isEmpty ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("noUsers")}
              </div>
            ) : isNoResults ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">{t("noSearchResults")}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("noSearchResultsDescription")}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearSearch}
                  className="mt-4"
                >
                  {t("clearSearch")}
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("email")}</TableHead>
                    <TableHead>{t("emailVerified")}</TableHead>
                    <TableHead>{t("kycStatus")}</TableHead>
                    <TableHead>{t("role")}</TableHead>
                    <TableHead>{t("banned")}</TableHead>
                    <TableHead>{t("createdAt")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isCurrentUser = user.id === currentUserId;
                    const isRowLoading = loading === user.id;
                    return (
                      <TableRow
                        key={user.id}
                        className={
                          isRowLoading
                            ? "opacity-50 transition-opacity"
                            : "transition-opacity"
                        }
                      >
                        <TableCell className="font-medium">
                          {user.name}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {user.emailVerified ? (
                            <Badge
                              variant="default"
                              className="gap-1 font-normal"
                            >
                              <Check className="h-3 w-3" />
                              {t("verified")}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="font-normal">
                              {t("unverified")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {getKycStatusBadge(user.kycStatus)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value) =>
                              handleRoleChange(user.id, value)
                            }
                            disabled={isRowLoading || isCurrentUser}
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">
                                {t("roleUser")}
                              </SelectItem>
                              <SelectItem value="admin">
                                {t("roleAdmin")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {user.banned ? (
                            <Badge variant="destructive">
                              {t("bannedStatus")}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              {t("activeStatus")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Intl.DateTimeFormat("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }).format(new Date(user.createdAt))}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant={user.banned ? "outline" : "destructive"}
                            size="sm"
                            onClick={() => handleBanClick(user)}
                            disabled={isRowLoading || isCurrentUser}
                          >
                            {user.banned ? t("unban") : t("ban")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {!isEmpty && !isNoResults && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {t("showingRange", {
                  start: startIndex,
                  end: endIndex,
                  total: pagination.total,
                })}
              </div>

              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      text={t("previous")}
                      ariaLabel={t("paginationPrevious")}
                      onClick={() =>
                        handlePageChange(pagination.currentPage - 1)
                      }
                      aria-disabled={pagination.currentPage === 1}
                      className={
                        pagination.currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : ""
                      }
                    />
                  </PaginationItem>

                  {getPageNumbers().map((page, idx) => (
                    <PaginationItem
                      key={
                        page === "ellipsis" ? `ellipsis-${idx}` : `page-${page}`
                      }
                    >
                      {page === "ellipsis" ? (
                        <PaginationEllipsis srText={t("paginationMore")} />
                      ) : (
                        <PaginationLink
                          onClick={() => handlePageChange(page as number)}
                          isActive={page === pagination.currentPage}
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      text={t("next")}
                      ariaLabel={t("paginationNext")}
                      onClick={() =>
                        handlePageChange(pagination.currentPage + 1)
                      }
                      aria-disabled={
                        pagination.currentPage === pagination.totalPages
                      }
                      className={
                        pagination.currentPage === pagination.totalPages
                          ? "pointer-events-none opacity-50"
                          : ""
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>

              <div className="flex items-center gap-2">
                <Select
                  value={String(pagination.limit)}
                  onValueChange={handleLimitChange}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">
                      {"10"} {t("perPage")}
                    </SelectItem>
                    <SelectItem value="25">
                      {"25"} {t("perPage")}
                    </SelectItem>
                    <SelectItem value="50">
                      {"50"} {t("perPage")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* Ban confirmation dialog */}
      <Dialog
        open={banDialogOpen}
        onOpenChange={(open) => {
          // Prevent closing while ban is in progress
          if (!open && isSubmitting) return;
          setBanDialogOpen(open);
          if (!open) {
            setSelectedUser(null);
            setBanReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("banDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("banDialogDescription", { name: selectedUser?.name || "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="banReason">{t("banReasonLabel")}</Label>
              <Input
                id="banReason"
                placeholder={t("banReasonPlaceholder")}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={() => {
                setBanDialogOpen(false);
                setSelectedUser(null);
                setBanReason("");
              }}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleBanConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? t("loading") : t("confirmBan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unban confirmation dialog */}
      <Dialog
        open={unbanDialogOpen}
        onOpenChange={(open) => {
          if (!open && isSubmitting) return;
          setUnbanDialogOpen(open);
          if (!open) {
            setSelectedUser(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("unbanDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("unbanDialogDescription", {
                name: selectedUser?.name || "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={() => {
                setUnbanDialogOpen(false);
                setSelectedUser(null);
              }}
            >
              {t("cancel")}
            </Button>
            <Button onClick={handleUnbanConfirm} disabled={isSubmitting}>
              {isSubmitting ? t("loading") : t("confirmUnban")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
