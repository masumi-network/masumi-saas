"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { changeEmail } from "@/lib/auth/auth.client";

const emailFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type EmailFormType = z.infer<typeof emailFormSchema>;

interface EmailFormProps {
  currentEmail: string | null;
}

export function EmailForm({ currentEmail }: EmailFormProps) {
  const t = useTranslations("App.Account.Email");
  const router = useRouter();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string>("");
  const [isConfirming, setIsConfirming] = useState(false);

  const form = useForm<EmailFormType>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleFormSubmit = (values: EmailFormType) => {
    setPendingEmail(values.email);
    setShowConfirmDialog(true);
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    const changeEmailResult = await changeEmail({
      newEmail: pendingEmail,
      callbackURL: "/",
    });

    if (changeEmailResult.error) {
      const errorMessage = changeEmailResult.error.message ?? t("error");
      toast.error(errorMessage);
      setShowConfirmDialog(false);
    } else {
      toast.success(t("success"));
      form.reset();
      setShowConfirmDialog(false);
      router.refresh();
    }
    setIsConfirming(false);
  };

  const { isSubmitting } = form.formState;

  return (
    <>
      <Card className="flex h-full flex-col">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)}>
            <fieldset className="space-y-6" disabled={isSubmitting}>
              <CardHeader>
                <CardTitle>{t("title")}</CardTitle>
                <CardDescription>{t("description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("newEmail")}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t("emailPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting && <Spinner size={16} className="mr-2" />}
                  {t("submit")}
                </Button>
              </CardFooter>
            </fieldset>
          </form>
        </Form>
      </Card>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmTitle")}</DialogTitle>
            <DialogDescription>
              {(() => {
                const oldEmail = currentEmail || t("currentEmailFallback");
                const text = t("confirmDescription", {
                  oldEmail,
                  newEmail: pendingEmail,
                });
                const parts = text.split(oldEmail);
                if (parts.length === 2) {
                  const [before, after] = parts;
                  const newEmailParts = after.split(pendingEmail);
                  if (newEmailParts.length === 2) {
                    const [middle, end] = newEmailParts;
                    return (
                      <>
                        {before}
                        <span className="text-foreground">{oldEmail}</span>
                        {middle}
                        <span className="text-foreground">{pendingEmail}</span>
                        {end}
                      </>
                    );
                  }
                }
                return text;
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isConfirming}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isConfirming}
              variant="primary"
            >
              {isConfirming && <Spinner size={16} className="mr-2" />}
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
