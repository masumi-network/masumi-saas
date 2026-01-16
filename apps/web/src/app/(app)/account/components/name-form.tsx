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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { updateUserNameAction } from "@/lib/actions/auth.action";

const nameFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

type NameFormType = z.infer<typeof nameFormSchema>;

export function NameForm() {
  const t = useTranslations("App.Account.Name");
  const router = useRouter();

  const form = useForm<NameFormType>({
    resolver: zodResolver(nameFormSchema),
    defaultValues: {
      name: "",
    },
  });

  const handleSubmit = async (values: NameFormType) => {
    const formData = new FormData();
    formData.append("name", values.name);

    const result = await updateUserNameAction(formData);

    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(t("success"));
      form.reset();
      router.refresh();
    }
  };

  const { isSubmitting } = form.formState;

  return (
    <Card className="flex h-full flex-col">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <fieldset className="space-y-6" disabled={isSubmitting}>
            <CardHeader>
              <CardTitle>{t("title")}</CardTitle>
              <CardDescription>{t("description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("newName")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("namePlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting && <Spinner size={16} className="mr-2" />}
                {t("submit")}
              </Button>
            </CardFooter>
          </fieldset>
        </form>
      </Form>
    </Card>
  );
}
