"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
  DialogTrigger,
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
import { deleteAccountAction } from "@/lib/actions/auth.action";

const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
});

type DeleteAccountFormType = z.infer<typeof deleteAccountSchema>;

export function DeleteAccountForm() {
  const t = useTranslations("App.Account.Delete");
  const router = useRouter();

  const form = useForm<DeleteAccountFormType>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: {
      currentPassword: "",
    },
  });

  const handleSubmit = async (values: DeleteAccountFormType) => {
    const formData = new FormData();
    formData.append("currentPassword", values.currentPassword);

    const result = await deleteAccountAction(formData);

    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(t("success"));
      router.push("/signin");
    }
  };

  const { isSubmitting } = form.formState;

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive">{t("button")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("confirmTitle")}</DialogTitle>
              <DialogDescription>{t("confirmDescription")}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)}>
                <fieldset className="space-y-4" disabled={isSubmitting}>
                  <FormField
                    control={form.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("currentPassword")}</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={isSubmitting}
                    >
                      {isSubmitting && <Spinner size={16} className="mr-2" />}
                      {t("confirm")}
                    </Button>
                  </DialogFooter>
                </fieldset>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
