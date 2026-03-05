"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { OrganizationRoleBadge } from "@/components/organizations";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  cancelInvitationAction,
  type OrgInvitation,
} from "@/lib/actions/organization.action";

interface PendingInvitationsListProps {
  invitations: OrgInvitation[];
  onMutationSuccess: () => void;
}

export function PendingInvitationsList({
  invitations,
  onMutationSuccess,
}: PendingInvitationsListProps) {
  const t = useTranslations("App.Organizations.Dashboard.membersSection");

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-tight text-muted-foreground">
        {t("pendingInvitations")}
      </p>
      <ul className="space-y-2">
        {invitations.map((invitation) => (
          <InvitationRow
            key={invitation.id}
            invitation={invitation}
            onMutationSuccess={onMutationSuccess}
          />
        ))}
      </ul>
    </div>
  );
}

interface InvitationRowProps {
  invitation: OrgInvitation;
  onMutationSuccess: () => void;
}

function InvitationRow({ invitation, onMutationSuccess }: InvitationRowProps) {
  const t = useTranslations("App.Organizations.Dashboard.membersSection");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelConfirm = async () => {
    setIsCancelling(true);
    const result = await cancelInvitationAction({
      invitationId: invitation.id,
    });
    if (result.success) {
      toast.success(t("cancelInvitationSuccess"));
      setConfirmOpen(false);
      onMutationSuccess();
    } else {
      toast.error(result.error ?? t("cancelInvitationError"));
      setIsCancelling(false);
    }
  };

  const expiryDate = new Date(invitation.expiresAt).toLocaleDateString(
    undefined,
    { year: "numeric", month: "short", day: "numeric" },
  );

  return (
    <>
      <li className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
        <div className="min-w-0 flex items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{invitation.email}</p>
            <p className="text-xs text-muted-foreground">
              {t("expiresDate", { date: expiryDate })}
            </p>
          </div>
          {invitation.role && <OrganizationRoleBadge role={invitation.role} />}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
          disabled={isCancelling}
        >
          {t("cancelInvitation")}
        </Button>
      </li>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!isCancelling) setConfirmOpen(open);
        }}
        title={t("cancelInvitationConfirmTitle")}
        description={t("cancelInvitationConfirmDescription", {
          email: invitation.email,
        })}
        confirmText={t("cancelInvitation")}
        variant="destructive"
        isLoading={isCancelling}
        onConfirm={handleCancelConfirm}
      />
    </>
  );
}
