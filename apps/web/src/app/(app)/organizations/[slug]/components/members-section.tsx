"use client";

import { Trash2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { OrganizationRoleBadge } from "@/components/organizations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import {
  type OrgInvitation,
  type OrgMember,
  removeMemberAction,
  updateMemberRoleAction,
} from "@/lib/actions/organization.action";

import { PendingInvitationsList } from "./pending-invitations-list";

interface MembersSectionProps {
  members: OrgMember[];
  pendingInvitations: OrgInvitation[];
  organizationId: string;
  currentUserRole: string;
  onMutationSuccess: () => void;
}

export function MembersSection({
  members,
  pendingInvitations,
  organizationId,
  currentUserRole,
  onMutationSuccess,
}: MembersSectionProps) {
  const t = useTranslations("App.Organizations.Dashboard.membersSection");
  const isOwnerOrAdmin =
    currentUserRole === "owner" || currentUserRole === "admin";

  return (
    <Card className="min-w-0 overflow-hidden rounded-lg shadow-none">
      <CardHeader>
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="inline-flex items-center gap-1 leading-none font-semibold">
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <Users className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columnMember")}</TableHead>
                <TableHead>{t("columnRole")}</TableHead>
                <TableHead>{t("columnJoined")}</TableHead>
                {isOwnerOrAdmin && <TableHead className="w-[120px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  organizationId={organizationId}
                  currentUserRole={currentUserRole}
                  onMutationSuccess={onMutationSuccess}
                />
              ))}
            </TableBody>
          </Table>
        )}

        {isOwnerOrAdmin && pendingInvitations.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <PendingInvitationsList
              invitations={pendingInvitations}
              onMutationSuccess={onMutationSuccess}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MemberRowProps {
  member: OrgMember;
  organizationId: string;
  currentUserRole: string;
  onMutationSuccess: () => void;
}

function MemberRow({
  member,
  organizationId,
  currentUserRole,
  onMutationSuccess,
}: MemberRowProps) {
  const t = useTranslations("App.Organizations.Dashboard.membersSection");
  const tRole = useTranslations("App.Organizations.Role");
  // Owner can modify admins and members; admin can modify only members (owner > admin > member)
  const canModifyMember =
    (currentUserRole === "owner" && member.role !== "owner") ||
    (currentUserRole === "admin" && member.role === "member");

  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRoleChange = async (newRole: string) => {
    setIsUpdatingRole(true);
    try {
      const result = await updateMemberRoleAction({
        memberId: member.id,
        role: newRole,
        organizationId,
      });
      if (result.success) {
        toast.success(t("roleUpdated"));
        onMutationSuccess();
      } else {
        toast.error(result.error ?? t("roleUpdateError"));
      }
    } catch {
      toast.error(t("roleUpdateError"));
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleRemoveConfirm = async () => {
    setIsRemoving(true);
    try {
      const result = await removeMemberAction({
        memberId: member.id,
        organizationId,
      });
      if (result.success) {
        toast.success(t("removeSuccess"));
        setConfirmOpen(false);
        onMutationSuccess();
      } else {
        toast.error(result.error ?? t("removeError"));
      }
    } catch {
      toast.error(t("removeError"));
    } finally {
      setIsRemoving(false);
    }
  };

  const initials = member.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");

  const joinedDate = new Date(member.joinedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <>
      <TableRow>
        {/* Member info */}
        <TableCell>
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{member.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {member.email}
              </p>
            </div>
          </div>
        </TableCell>

        {/* Role */}
        <TableCell>
          {canModifyMember ? (
            <Select
              value={member.role}
              onValueChange={handleRoleChange}
              disabled={isUpdatingRole}
            >
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">{tRole("member")}</SelectItem>
                <SelectItem value="admin">{tRole("admin")}</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <OrganizationRoleBadge role={member.role} />
          )}
        </TableCell>

        {/* Joined date */}
        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
          {joinedDate}
        </TableCell>

        {/* Actions */}
        {(currentUserRole === "owner" || currentUserRole === "admin") && (
          <TableCell className="text-right">
            {canModifyMember && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmOpen(true)}
                disabled={isRemoving}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">{t("removeConfirmTitle")}</span>
              </Button>
            )}
          </TableCell>
        )}
      </TableRow>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!isRemoving) setConfirmOpen(open);
        }}
        title={t("removeConfirmTitle")}
        description={t("removeConfirmDescription", { name: member.name })}
        confirmText={t("removeConfirm")}
        variant="destructive"
        isLoading={isRemoving}
        onConfirm={handleRemoveConfirm}
      />
    </>
  );
}
