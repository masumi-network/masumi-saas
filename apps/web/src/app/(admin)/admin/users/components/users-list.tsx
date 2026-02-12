"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
import { authClient } from "@/lib/auth/auth.client";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
  banReason: string | null;
  createdAt: string;
}

interface UsersListProps {
  currentUserId?: string;
  initialUsers: User[];
}

export default function UsersList({
  currentUserId,
  initialUsers,
}: UsersListProps) {
  const t = useTranslations("Admin.Users");
  const router = useRouter();
  const [users] = useState<User[]>(initialUsers);
  const [loading, setLoading] = useState<string | null>(null);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [banReason, setBanReason] = useState("");

  const handleRoleChange = async (userId: string, newRole: string) => {
    // SECURITY: Prevent self-demotion
    if (userId === currentUserId) {
      toast.error(t("cannotModifySelf"));
      return;
    }

    setLoading(userId);
    try {
      const result = await authClient.admin.setRole({
        userId,
        role: newRole,
      });

      if (result.error) {
        toast.error(t("error"));
        console.error("Role change failed:", result.error);
      } else {
        toast.success(t("roleUpdateSuccess"));
        // M9 FIX: Revalidate from server to avoid state divergence
        router.refresh();
      }
    } catch (error) {
      console.error("Role change failed:", error);
      toast.error(t("error"));
    } finally {
      setLoading(null);
    }
  };

  const handleBanClick = (user: User) => {
    // SECURITY: Prevent self-ban
    if (user.id === currentUserId) {
      toast.error(t("cannotModifySelf"));
      return;
    }

    if (user.banned) {
      // Unban directly without dialog
      handleUnban(user.id);
    } else {
      // Show dialog for ban
      setSelectedUser(user);
      setBanReason("");
      setBanDialogOpen(true);
    }
  };

  const handleUnban = async (userId: string) => {
    setLoading(userId);
    try {
      const result = await authClient.admin.unbanUser({ userId });
      if (result.error) {
        toast.error(t("error"));
        console.error("Unban failed:", result.error);
      } else {
        toast.success(t("unbanSuccess"));
        // M9 FIX: Revalidate from server to avoid state divergence
        router.refresh();
      }
    } catch (error) {
      console.error("Unban failed:", error);
      toast.error(t("error"));
    } finally {
      setLoading(null);
    }
  };

  const handleBanConfirm = async () => {
    if (!selectedUser) return;

    const reason = banReason.trim() || t("defaultBanReason");
    setLoading(selectedUser.id);
    setBanDialogOpen(false);

    try {
      const result = await authClient.admin.banUser({
        userId: selectedUser.id,
        banReason: reason,
      });
      if (result.error) {
        toast.error(t("error"));
        console.error("Ban failed:", result.error);
      } else {
        toast.success(t("banSuccess"));
        // M9 FIX: Revalidate from server to avoid state divergence
        router.refresh();
      }
    } catch (error) {
      console.error("Ban failed:", error);
      toast.error(t("error"));
    } finally {
      setLoading(null);
      setSelectedUser(null);
      setBanReason("");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t("noUsers")}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("email")}</TableHead>
                <TableHead>{t("role")}</TableHead>
                <TableHead>{t("banned")}</TableHead>
                <TableHead>{t("createdAt")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isCurrentUser = user.id === currentUserId;
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value) =>
                          handleRoleChange(user.id, value)
                        }
                        disabled={loading === user.id || isCurrentUser}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">{t("roleUser")}</SelectItem>
                          <SelectItem value="admin">
                            {t("roleAdmin")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {user.banned ? (
                        <Badge variant="destructive">{t("bannedStatus")}</Badge>
                      ) : (
                        <Badge variant="secondary">{t("activeStatus")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant={user.banned ? "outline" : "destructive"}
                        size="sm"
                        onClick={() => handleBanClick(user)}
                        disabled={loading === user.id || isCurrentUser}
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
      </CardContent>

      {/* M4 FIX: Ban confirmation dialog with reason input */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
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
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBanDialogOpen(false);
                setSelectedUser(null);
                setBanReason("");
              }}
            >
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleBanConfirm}>
              {t("confirmBan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
