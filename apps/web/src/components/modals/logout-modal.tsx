"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { signOut } from "@/lib/auth/auth.client";

import { Spinner } from "../ui/spinner";

interface LogoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
}

export default function LogoutModal({
  open,
  onOpenChange,
  email,
}: LogoutModalProps) {
  const t = useTranslations("Components.LogoutModal");
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    const signInPath = pathname.startsWith("/admin")
      ? "/admin/signin"
      : "/signin";
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push(signInPath);
          },
          onError: () => {
            toast.error(t("error"));
          },
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-lg font-medium">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-center text-base">
            {t("description", { email })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="block space-y-1.5">
          <Button
            variant="primary"
            className="w-full"
            onClick={handleLogout}
            disabled={loading}
          >
            {loading && <Spinner size={16} className="mr-2" />}
            {t("logout")}
          </Button>
          <DialogClose asChild>
            <Button variant="secondary" className="w-full" disabled={loading}>
              {t("cancel")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
